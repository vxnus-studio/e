import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth-server";
import { getPublisherProfile, isControlPlaneConfigured, listProjectReleases, listPublisherProjects } from "@/lib/supabase-control-plane";
import { projectSlug } from "@/lib/project-slug";
import { DashboardShell } from "../../dashboard-shell";
import { UsernameSetup } from "../../username-setup";
import { ProjectView } from "./project-view";
import "../../workspace.css";
import "../../dashboard.css";

export const dynamic = "force-dynamic";

export default async function ProjectReleasePage({ params }: { params: Promise<{ project: string }> }) {
  const { project: slug } = await params;
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect(`/auth/sign-in?redirectTo=/publish/${slug}/release`);
  const ready = isControlPlaneConfigured();
  const profile = ready ? await getPublisherProfile(session.user.id) : undefined;
  if (ready && !profile) return <main className="dashboard-page"><section className="dashboard-main"><UsernameSetup /></section></main>;
  const projects = ready ? await listPublisherProjects(session.user.id) : [];
  const project = projects.find((item) => projectSlug(item.name) === slug);
  if (ready && !project) notFound();
  if (!project) return <DashboardShell active="releases" email={session.user.email}><div className="workspace-notice"><strong>Project workspace is not configured yet.</strong><span>Set <code>DATABASE_URL</code> and apply the project migrations.</span></div></DashboardShell>;
  const releases = await listProjectReleases(session.user.id, project.id);

  return (
    <DashboardShell active="releases" email={session.user.email}>
      <ProjectView project={project} releases={releases} />
    </DashboardShell>
  );
}
