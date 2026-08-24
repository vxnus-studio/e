import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { neon } from "@neondatabase/serverless";
import { loadPack } from "@vxnus/e-knowledge";
import { auth } from "@/lib/auth-server";
import { createR2ArchiveStore } from "@/lib/r2";
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
    if (!process.env.NEON_DATABASE_URL) throw new Error("NEON_DATABASE_URL is required to publish.");
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
    const sql = neon(process.env.NEON_DATABASE_URL);
    await sql`INSERT INTO registry_packs (package_id, name, publisher, version, schema_version, description, sources, capabilities, publisher_id, distribution, verified) VALUES (${pack.manifest.id}, ${pack.manifest.name}, ${pack.manifest.publisher}, ${pack.manifest.version}, ${pack.manifest.schemaVersion}, ${pack.manifest.description || null}, ${JSON.stringify(pack.manifest.sources)}::jsonb, ${JSON.stringify(pack.manifest.capabilities)}::jsonb, ${session.user.id}, ${JSON.stringify({ kind: "archive", url: r2.publicUrl(key), checksum })}::jsonb, FALSE)`;
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
