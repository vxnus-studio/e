import { auth } from "@/lib/auth-server";
import { createPublisherProject, isControlPlaneConfigured } from "@/lib/supabase-control-plane";
import { getDatabase } from "@/db";
import { publisherProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const { data: session } = await auth.getSession();
  if (!session?.user) return Response.json({ message: "Sign in to create a project." }, { status: 401 });
  if (!isControlPlaneConfigured()) return Response.json({ message: "Project workspace is not configured yet." }, { status: 503 });
  const body = await request.json() as { name?: string; description?: string };
  const profile = await getDatabase().select({ username: publisherProfiles.username }).from(publisherProfiles).where(eq(publisherProfiles.userId, session.user.id)).limit(1);
  const publisher = String(profile[0]?.username || "").toLowerCase();
  if (!publisher || !/^([a-z0-9][a-z0-9-]{1,30})$/.test(publisher)) return Response.json({ message: "Your account does not have a valid username." }, { status: 400 });
  if (!body.name?.trim()) return Response.json({ message: "A project name is required." }, { status: 400 });
  try { return Response.json({ project: await createPublisherProject({ ownerId: session.user.id, publisher, name: body.name.trim(), description: body.description?.trim() }) }, { status: 201 }); }
  catch (error) { return Response.json({ message: error instanceof Error ? error.message : "Project could not be created." }, { status: 400 }); }
}
