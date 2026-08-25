import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth-server";
import { getPublisherProfile, isControlPlaneConfigured, listProjectReleases, listPublisherProjects } from "@/lib/supabase-control-plane";
import { projectSlug } from "@/lib/project-slug";
import { DashboardShell } from "../../dashboard-shell";
import { PublishForm } from "../../publish-form";
import { ProjectSettings } from "../../project-settings";
import { UsernameSetup } from "../../username-setup";
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

  return <DashboardShell active="releases" email={session.user.email}>
    <header className="dashboard-topbar"><div><span className="breadcrumb">Workspace <b>/</b> {project.name} <b>/</b> Releases</span><h1>{project.name} releases.</h1><p className="dashboard-subtitle">@{project.publisher} · {project.description || "Knowledge project"}</p></div><Link className="button button-dark" href={`/projects/${project.publisher}/${projectSlug(project.name)}`}>View public page ↗</Link></header>
    <section className="dashboard-section"><div className="section-bar"><div><span className="dashboard-kicker">Project release history</span><h2>Versions</h2></div><span className="section-count">{releases.length} total</span></div>
      {releases.length ? <div className="release-table-wrap"><table className="release-table"><thead><tr><th>Package</th><th>Version</th><th>Status</th><th>Published</th><th>Checksum</th></tr></thead><tbody>{releases.map((release) => <tr key={release.id}><td><strong>{release.packageId}</strong></td><td><code>v{release.version}</code></td><td><span className="table-status"><i />{release.distributionStatus || release.status}</span></td><td>{release.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td><td><code>{release.checksum ? `${release.checksum.slice(0, 10)}…` : "—"}</code></td></tr>)}</tbody></table></div> : <div className="dashboard-empty compact"><span className="empty-mark">↗</span><div><h3>No releases yet</h3><p>Publish the first version of this project below.</p></div></div>}
    </section>
    <ProjectSettings project={project} releaseCount={releases.length} />
    <section className="dashboard-upload"><div><span className="dashboard-kicker">New release</span><h2>Ship another version.</h2><p>Upload a portable E pack or connect a remote provider for this project.</p></div><PublishForm projectId={project.id} /></section>
  </DashboardShell>;
}
