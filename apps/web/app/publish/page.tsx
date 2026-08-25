import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-server";
import { getPublisherProfile, isControlPlaneConfigured, listPublisherProjects, listPublisherReleases } from "@/lib/supabase-control-plane";
import { ProjectCreator } from "./project-creator";
import { PublishForm } from "./publish-form";
import { DashboardShell } from "./dashboard-shell";
import "./workspace.css";
import "./dashboard.css";
import { UsernameSetup } from "./username-setup";

export const dynamic = "force-dynamic";

export default async function PublishPage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in?redirectTo=/publish");
  const ready = isControlPlaneConfigured();
  const profile = ready ? await getPublisherProfile(session.user.id) : undefined;
  if (ready && !profile) return <main className="dashboard-page"><section className="dashboard-main"><UsernameSetup /></section></main>;
  const [projects, releases] = ready ? await Promise.all([listPublisherProjects(session.user.id), listPublisherReleases(session.user.id)]) : [[], []];
  const project = projects.find((item) => item.publisher === "vxnuslabs") ?? projects[0];
  const published = releases.filter((release) => release.status === "published").length;
  return <DashboardShell active="overview" email={session.user.email}><header className="dashboard-topbar"><div><span className="breadcrumb">Workspace <b>/</b> Overview</span><h1>Good to see you back.</h1></div><ProjectCreator /></header>
      {!ready && <div className="workspace-notice"><strong>Connect the Supabase database to start publishing.</strong><span>Set <code>DATABASE_URL</code> and apply the project migrations.</span></div>}
      <div className="metric-grid"><article><span>Projects</span><strong>{projects.length}</strong><small>owned namespaces</small></article><article><span>Releases</span><strong>{published}</strong><small>published versions</small></article><article><span>Health</span><strong className="metric-good">{ready ? "Ready" : "Setup"}</strong><small>{ready ? "control plane online" : "awaiting database"}</small></article></div>
      <section className="dashboard-section" id="projects"><div className="section-bar"><div><span className="dashboard-kicker">Your workspace</span><h2>Projects</h2></div><span className="section-count">{projects.length} total</span></div>{project ? <article className="project-card"><div className="project-card-mark">@</div><div><span className="project-status"><i /> Active project</span><h3>@{project.publisher}</h3><p>{project.description || project.name}</p></div><Link className="project-open" href="/publish/releases">View releases <span>↗</span></Link></article> : <div className="dashboard-empty"><span className="empty-mark">+</span><div><h3>Create your first project</h3><p>A project owns your publisher namespace, sources, revisions, and releases.</p></div></div>}</section>
      <section className="dashboard-section" id="releases"><div className="section-bar"><div><span className="dashboard-kicker">Release history</span><h2>Recent releases</h2></div><span className="section-count">{releases.length} total</span></div>{releases.length ? <div className="release-table-wrap"><table className="release-table"><thead><tr><th>Package</th><th>Version</th><th>Status</th><th>Published</th><th>Checksum</th></tr></thead><tbody>{releases.map((release) => <tr key={release.id}><td><strong>{release.packageId}</strong></td><td><code>v{release.version}</code></td><td><span className="table-status"><i />{release.distributionStatus || release.status}</span></td><td>{release.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td><td><code>{release.checksum ? `${release.checksum.slice(0, 10)}…` : "—"}</code></td></tr>)}</tbody></table></div> : <div className="dashboard-empty compact"><span className="empty-mark">↗</span><div><h3>No releases yet</h3><p>Publish a validated archive into your project to see its release history here.</p></div></div>}</section>
      <section className="dashboard-upload"><div><span className="dashboard-kicker">New release</span><h2>Make knowledge available.</h2><p>Upload a portable E pack. We validate the archive and preserve its provenance.</p></div><PublishForm projectId={project?.id} /></section>
  </DashboardShell>;
}
