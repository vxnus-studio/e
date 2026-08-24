import { auth } from "@/lib/auth-server";
import { claimProviderPack } from "@/lib/supabase-registry";
import { getDatabase } from "@/db";
import { and, eq } from "drizzle-orm";
import { publisherProjects, registryPacks } from "@/db/schema";
import { validateManifest } from "@vxnus/e";

const providerUrl = (process.env.TEYVAT_PROVIDER_URL || "https://eteyvat.vxnus.xyz/api/knowledge").replace(/\/+$/, "");

export async function POST(request: Request) {
  const { data: session } = await auth.getSession();
  if (!session?.user) return Response.json({ message: "Sign in to claim E-Teyvat." }, { status: 401 });
  const body = await request.json() as { projectId?: string };
  if (!body.projectId) return Response.json({ message: "A project is required." }, { status: 400 });
  try {
    const project = await getDatabase().select({ publisher: publisherProjects.publisher }).from(publisherProjects).where(and(eq(publisherProjects.id, body.projectId), eq(publisherProjects.ownerId, session.user.id))).limit(1);
    if (project[0]?.publisher !== "vxnuslabs") throw new Error("Create or select a vxnuslabs project first.");
    const response = await fetch(`${providerUrl}/manifest`, { cache: "no-store" });
    if (!response.ok) throw new Error(`E-Teyvat manifest returned HTTP ${response.status}.`);
    const manifest = validateManifest(await response.json());
    if (manifest.id !== "@vxnus/teyvat" || manifest.publisher !== "vxnuslabs") throw new Error("The live provider identity does not match E-Teyvat.");
    const existing = await getDatabase().select({ packageId: registryPacks.packageId }).from(registryPacks).where(and(eq(registryPacks.packageId, manifest.id), eq(registryPacks.version, manifest.version))).limit(1);
    if (existing[0]) return Response.json({ message: "E-Teyvat is already registered." }, { status: 409 });
    const pack = { ...manifest, publisherId: session.user.id, verified: true, distribution: { kind: "provider" as const, url: providerUrl } };
    await claimProviderPack({ projectId: body.projectId, ownerId: session.user.id, pack, revisionManifest: manifest, revisionId: `provider-${manifest.version}` });
    return Response.json({ packageId: pack.id, version: pack.version, owner: session.user.id }, { status: 201 });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "E-Teyvat could not be claimed." }, { status: 400 });
  }
}
