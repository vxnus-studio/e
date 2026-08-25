import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-server";
import { getPublisherProfile, isControlPlaneConfigured, listPublisherProjects } from "@/lib/supabase-control-plane";
import { projectSlug } from "@/lib/project-slug";

export const dynamic = "force-dynamic";

export default async function ReleasesPage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in?redirectTo=/publish/releases");
  if (!isControlPlaneConfigured()) redirect("/publish");
  const profile = await getPublisherProfile(session.user.id);
  if (!profile) redirect("/publish");
  const projects = await listPublisherProjects(session.user.id);
  if (!projects[0]) redirect("/publish");
  redirect(`/publish/${projectSlug(projects[0].name)}/release`);
}
