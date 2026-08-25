import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-server";
import { getPublisherProfile, isControlPlaneConfigured, listPublisherProjects } from "@/lib/supabase-control-plane";
import { DashboardShell } from "../dashboard-shell";
import { ProjectCreator } from "../project-creator";
import { UsernameSetup } from "../username-setup";
import "../workspace.css";
import "../dashboard.css";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in?redirectTo=/publish/projects");
  const ready = isControlPlaneConfigured();
  const profile = ready ? await getPublisherProfile(session.user.id) : undefined;
  if (ready && !profile) return <main className="dashboard-page"><section className="dashboard-main"><UsernameSetup /></section></main>;
  const projects = ready ? await listPublisherProjects(session.user.id) : [];
  return <DashboardShell active="projects" email={session.user.email}>
    <header className="dashboard-topbar"><div><span className="breadcrumb">Workspace <b>/</b> Projects</span><h1>Your projects.</h1></div><ProjectCreator /></header>
    {!ready && <div className="workspace-notice"><strong>Connect the Supabase database to manage projects.</strong><span>Set <code>DATABASE_URL</code> and apply the project migrations.</span></div>}
    <section className="dashboard-section"><div className="section-bar"><div><span className="dashboard-kicker">Publisher namespaces</span><h2>Projects</h2></div><span className="section-count">{projects.length} total</span></div>
      {projects.length ? <div className="project-list">{projects.map((project, index) => <article className="project-row" key={project.id}><span className="project-index">/{String(index + 1).padStart(2, "0")}</span><div><h3>{project.name}</h3><p>@{project.publisher} · {project.description || "Knowledge project"}</p></div><span className={`visibility ${project.visibility}`}>{project.visibility}</span><span className="project-arrow">↗</span></article>)}</div> : <div className="dashboard-empty"><span className="empty-mark">+</span><div><h3>Create your first project</h3><p>A project owns your publisher namespace, sources, revisions, and releases.</p></div></div>}
    </section>
  </DashboardShell>;
}
