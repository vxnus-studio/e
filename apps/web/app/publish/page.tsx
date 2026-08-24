import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-server";
import { isControlPlaneConfigured, listPublisherProjects } from "@/lib/supabase-control-plane";
import { PublishForm } from "./publish-form";
import { ProjectCreator } from "./project-creator";
import "./workspace.css";

export const dynamic = "force-dynamic";

export default async function PublishPage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in?redirectTo=/publish");
  const projects = isControlPlaneConfigured() ? await listPublisherProjects(session.user.id) : [];
  return <main className="workspace-page">
    <nav className="publish-nav"><Link className="brand" href="/"><span className="brand-mark">E</span> knowledge hub</Link><div className="workspace-nav-meta"><span>{session.user.email || "Publisher"}</span><Link className="back-link" href="/">← Catalog</Link></div></nav>
    <section className="workspace-head"><div><p className="eyebrow">Publisher workspace / 08</p><h1>Ship knowledge<br /><em>with provenance.</em></h1><p className="workspace-lede">Projects keep sources, revisions, and releases together. You own the namespace; the Hub carries the distribution.</p></div><div className="workspace-signal"><span className="signal-dot" /> <strong>{isControlPlaneConfigured() ? "Control plane ready" : "Workspace setup pending"}</strong><small>{projects.length} project{projects.length === 1 ? "" : "s"} · private by default</small></div></section>
    <section className="workspace-content" aria-labelledby="projects-title"><div className="workspace-section-head"><div><p className="eyebrow">Your namespace</p><h2 id="projects-title">Projects</h2></div><ProjectCreator /></div>
      {!isControlPlaneConfigured() && <div className="workspace-notice"><strong>Supabase is the next connection.</strong><span>Apply <code>003_publisher_control_plane.sql</code> and add the server credentials to unlock owned projects.</span></div>}
      {projects.length ? <div className="project-list">{projects.map((project, index) => <article className="project-row" key={project.id}><span className="project-index">0{index + 1}</span><div><h3>@{project.publisher}</h3><p>{project.description || project.name}</p></div><span className={`visibility ${project.visibility}`}>{project.visibility}</span><span className="project-arrow">↗</span></article>)}</div> : <div className="workspace-empty"><span className="empty-mark">+</span><div><h3>Your first project starts here.</h3><p>Create a namespace, then upload a validated revision into it.</p></div></div>}
    </section>
    <section className="release-strip"><div><p className="eyebrow">Ingestion</p><h2>Have a pack ready?</h2><p>Upload a <code>.tar.gz</code> archive to validate its manifest, fingerprint its contents, and publish an immutable release.</p></div><PublishForm /></section>
  </main>;
}
