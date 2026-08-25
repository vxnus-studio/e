/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound, redirect } from "next/navigation";
import { registry } from "@/lib/registry";
import { getProjectByPublisher } from "@/lib/supabase-control-plane";
import { projectSlug } from "@/lib/project-slug";

export const dynamic = "force-dynamic";

async function PublicProjectPage({ params }: { params: Promise<{ publisher: string; project?: string }> }) {
  const { publisher, project: projectParam } = await params;
  const namespace = publisher.toLowerCase();
  const result = await registry.search({ query: `@${namespace}/`, limit: 100 });
  const packs = result.packs.filter((pack) => pack.id.startsWith(`@${namespace}/`));
  if (!packs.length) notFound();
  const project = process.env.DATABASE_URL ? await getProjectByPublisher(namespace) : undefined;
  if (project && !projectParam) redirect(`/projects/${namespace}/${projectSlug(project.name)}`);
  if (project?.name && projectParam && projectSlug(project.name) !== projectParam) notFound();
  const projectName = project?.name || projectParam || "Public knowledge project";
  const license = packs.find((pack) => pack.license)?.license;

  return <main className="detail-page">
    <nav className="site-nav" aria-label="Primary navigation"><a className="brand" href="/"><span className="brand-mark">E</span> knowledge hub</a><div className="nav-links"><a href="/#catalog">Catalog</a><a href="/publish">Publish</a><a className="nav-button" href="/auth/sign-in">Sign in</a></div></nav>
    <section className="detail-hero" aria-labelledby="project-title"><a className="back-link" href="/#catalog">← Back to catalog</a><div className="detail-heading"><div><p className="eyebrow">Public project</p><h1 id="project-title">{projectName}</h1><p className="detail-package">@{namespace}</p><p className="detail-lede">{project?.description || "A public knowledge project published through the Hub."}</p></div><div className="detail-version"><span>Project status</span><strong>{project?.visibility || "public"}</strong><small>Publisher workspace</small></div></div></section>
    <section className="detail-content" aria-label="Project metadata"><div className="detail-main"><p className="eyebrow">Project metadata</p><h2>A home for this publisher’s knowledge.</h2><p className="citation">This page describes the project itself. Published releases are managed privately from the publisher workspace.</p>{license?.notice && <p className="citation">{license.notice}</p>}</div><aside className="detail-aside"><div className="detail-block"><span className="detail-label">Project</span><strong>{projectName}</strong></div><div className="detail-block"><span className="detail-label">Publisher</span><strong>@{namespace}</strong></div><div className="detail-block"><span className="detail-label">Visibility</span><strong>{project?.visibility || "public"}</strong></div>{license && <div className="detail-block"><span className="detail-label">License</span><strong><a href={license.licenseUrl} target="_blank" rel="noreferrer">{license.licenseName}</a></strong>{license.rightsHolder && <small>Rights holder: {license.rightsHolder}</small>}{license.copyrightNotice && <small>{license.copyrightNotice}</small>}{license.attributionText && <small>Attribution: {license.attributionText}</small>}</div>}</aside></section>
    <footer><span>© 2026 E Knowledge Hub</span><span>Protocol by <a href="https://github.com/vxnuslabs/e">@vxnus/e</a></span></footer>
  </main>;
}

export default PublicProjectPage;
