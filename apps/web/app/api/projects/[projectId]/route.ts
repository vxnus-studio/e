import { auth } from "@/lib/auth-server";
import { deletePublisherProject, isControlPlaneConfigured, updatePublisherProject } from "@/lib/supabase-control-plane";

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { data: session } = await auth.getSession();
  if (!session?.user) return Response.json({ message: "Sign in to update a project." }, { status: 401 });
  if (!isControlPlaneConfigured()) return Response.json({ message: "Project workspace is not configured yet." }, { status: 503 });
  const { projectId } = await params;
  const body = await request.json() as { name?: string; description?: string; visibility?: string; manifest?: import("@vxnus/e").KnowledgePackManifest | null };
  const name = body.name?.trim();
  if (!name) return Response.json({ message: "A project name is required." }, { status: 400 });
  if (body.visibility !== "private" && body.visibility !== "public") return Response.json({ message: "Choose a valid project visibility." }, { status: 400 });
  try {
    const project = await updatePublisherProject({ ownerId: session.user.id, projectId, name, description: body.description?.trim(), visibility: body.visibility, manifest: body.manifest });
    if (!project) return Response.json({ message: "Project not found." }, { status: 404 });
    return Response.json({ project });
  } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "Project could not be updated." }, { status: 400 }); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { data: session } = await auth.getSession();
  if (!session?.user) return Response.json({ message: "Sign in to delete a project." }, { status: 401 });
  if (!isControlPlaneConfigured()) return Response.json({ message: "Project workspace is not configured yet." }, { status: 503 });
  const { projectId } = await params;
  try {
    const deleted = await deletePublisherProject({ ownerId: session.user.id, projectId });
    if (!deleted) return Response.json({ message: "Project not found or has no releases." }, { status: 404 });
    return Response.json({ deleted: true });
  } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "Project could not be deleted." }, { status: 400 }); }
}
