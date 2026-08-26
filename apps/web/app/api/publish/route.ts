import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadPack } from "@vxnus/e-knowledge";
import { validateManifest } from "@vxnus/e";
import type { RegistryPack } from "@vxnus/e-registry";
import { auth } from "@/lib/auth-server";
import { createR2ArchiveStore } from "@/lib/r2";
import { publishPack } from "@/lib/supabase-registry";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const run = promisify(execFile);
const MAX_BYTES = 25 * 1024 * 1024;

async function findPackRoot(root: string): Promise<string> {
  if ((await readdir(root)).includes("manifest.json")) return root;
  for (const entry of await readdir(root, { withFileTypes: true })) if (entry.isDirectory()) {
    const candidate = join(root, entry.name);
    if ((await readdir(candidate)).includes("manifest.json")) return candidate;
  }
  throw new Error("Archive must contain a manifest.json at its root.");
}

export async function POST(request: Request) {
  const { data: session } = await auth.getSession();
  if (!session?.user) return Response.json({ message: "Sign in to publish a pack." }, { status: 401 });
  const form = await request.formData();
  const projectId = form.get("projectId");
  if (typeof projectId !== "string" || !projectId) return Response.json({ message: "A project is required before publishing." }, { status: 400 });
  const kind = form.get("kind");
  if (kind === "url") {
    const rawUrl = String(form.get("url") || "").trim();
    const apiKey = String(form.get("apiKey") || "").trim();
    const version = String(form.get("version") || "1.0.0").trim();
    const description = String(form.get("description") || "").trim();
    let rawContract = form.get("apiContract");
    let apiContract: RegistryPack["apiContract"] | undefined;
    if (typeof rawContract === "string" && rawContract.trim()) {
      try { apiContract = JSON.parse(rawContract) as RegistryPack["apiContract"]; }
      catch { return Response.json({ message: "Invalid OpenAPI contract JSON." }, { status: 400 }); }
    }

    let url: URL;
    try { url = new URL(rawUrl); } catch { return Response.json({ message: "Enter a valid provider URL." }, { status: 400 }); }
    if (url.protocol !== "https:" && url.protocol !== "http:") return Response.json({ message: "Provider URLs must use HTTP/HTTPS." }, { status: 400 });
    if (url.username || url.password || url.search || url.hash) return Response.json({ message: "Provider URLs must be a base URL without credentials or query parameters." }, { status: 400 });
    if (!apiKey) return Response.json({ message: "A provider API key is required." }, { status: 400 });
    const providerUrl = url.toString().replace(/\/+$/, "");
    try {
      const verification = await fetch(`${providerUrl}/verify`, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: "{}",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (verification.status === 401) throw new Error("The provider API key is invalid.");
      if (verification.status === 403) throw new Error("The provider API key belongs to a different provider.");
      if (!verification.ok) throw new Error(`Provider verification returned HTTP ${verification.status}.`);
      const identity = await verification.json() as { id?: unknown; publisher?: unknown };
      if (typeof identity.id !== "string" || typeof identity.publisher !== "string") {
        throw new Error("Provider verification identity is invalid.");
      }

      const revisionId = `provider-${version}`;
      const packManifest = {
        id: identity.id,
        name: identity.id.split("/")[1] || identity.id,
        publisher: identity.publisher,
        version,
        schemaVersion: "1.0",
        description: description || undefined,
        sources: [{ id: "provider", title: `${identity.id} Provider`, license: "Proprietary" }],
        capabilities: { lexicalSearch: false, semanticSearch: false, structuredEntities: true, relations: true, revisions: true },
        apiContract,
      };

      const pack = {
        ...packManifest,
        publisherId: session.user.id,
        verified: true,
        distribution: { kind: "provider" as const, url: providerUrl },
        apiContract,
      };

      await publishPack({ projectId, ownerId: session.user.id, revisionId, revisionManifest: packManifest, pack, apiContract });
      return Response.json({ packageId: pack.id, version: pack.version, revision: revisionId, owner: session.user.id }, { status: 201 });
    } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "The provider could not be published." }, { status: 400 }); }
  }
  const file = form.get("pack");
  if (!(file instanceof File)) return Response.json({ message: "A .tar.gz pack is required." }, { status: 400 });
  if (file.size === 0 || file.size > MAX_BYTES) return Response.json({ message: "Pack archives must be between 1 byte and 25 MB." }, { status: 400 });
  if (!file.name.endsWith(".tar.gz") && !file.name.endsWith(".tgz")) return Response.json({ message: "Use a .tar.gz or .tgz archive." }, { status: 400 });
  const work = await mkdtemp(join(tmpdir(), "e-publish-"));
  let uploadedArchive: { client: S3Client; bucket: string; key: string } | undefined;
  try {
    const archive = join(work, "pack.tar.gz");
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(archive, bytes);
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const { stdout: listing } = await run("tar", ["-tzf", archive]);
    if (listing.split("\n").some((entry) => entry.startsWith("/") || entry.split("/").includes(".."))) throw new Error("Archive contains an unsafe path.");
    const extracted = join(work, "contents");
    await mkdir(extracted);
    await run("tar", ["-xzf", archive, "-C", extracted, "--no-same-owner", "--no-same-permissions", "--no-absolute-names"]);
    const pack = await loadPack(await findPackRoot(extracted));
    const match = pack.manifest.id.match(/^@([^/]+)\/([^/]+)$/);
    if (!match) throw new Error("Manifest id must use the @publisher/name format.");
    if (pack.manifest.id.includes("..")) throw new Error("Manifest id contains an invalid path.");
    const r2 = createR2ArchiveStore();
    const key = `${pack.manifest.id}/${pack.manifest.version}.tar.gz`;
    const accountId = process.env.R2_ACCOUNT_ID;
    const bucket = process.env.R2_BUCKET_NAME;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const base = accountId && bucket && accessKeyId && secretAccessKey;
    if (!base) throw new Error("R2 storage is not configured.");
    const client = new S3Client({ region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } });
    if (await r2.exists(key)) return Response.json({ message: "That package version already exists." }, { status: 409 });
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: "application/gzip" }));
    uploadedArchive = { client, bucket, key };
    await publishPack({ projectId, ownerId: session.user.id, revisionId: pack.revision.id, revisionManifest: pack.manifest, pack: { id: pack.manifest.id, name: pack.manifest.name, publisher: pack.manifest.publisher, version: pack.manifest.version, schemaVersion: pack.manifest.schemaVersion, description: pack.manifest.description, license: pack.manifest.license, sources: pack.manifest.sources, capabilities: pack.manifest.capabilities, publisherId: session.user.id, verified: false, distribution: { kind: "archive", url: r2.publicUrl(key), checksum } } });
    return Response.json({ packageId: pack.manifest.id, version: pack.manifest.version, revision: pack.revision.id, checksum, owner: session.user.id }, { status: 201 });
  } catch (error) {
    if (uploadedArchive) {
      try { await uploadedArchive.client.send(new DeleteObjectCommand({ Bucket: uploadedArchive.bucket, Key: uploadedArchive.key })); }
      catch { /* Preserve the original publish error; the object can be reconciled by checksum. */ }
    }
    const message = error instanceof Error ? error.message : "The pack could not be published.";
    return Response.json({ message }, { status: 400 });
  } finally { await rm(work, { recursive: true, force: true }); }
}
