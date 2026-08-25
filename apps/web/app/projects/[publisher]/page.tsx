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

  return <main className="detail-page">
    <nav className="site-nav" aria-label="Primary navigation"><a className="brand" href="/"><span className="brand-mark">E</span> knowledge hub</a><div className="nav-links"><a href="/#catalog">Catalog</a><a href="/publish">Publish</a><a className="nav-button" href="/auth/sign-in">Sign in</a></div></nav>
    <section className="detail-hero" aria-labelledby="project-title"><a className="back-link" href="/#catalog">← Back to catalog</a><div className="detail-heading"><div><p className="eyebrow">Public project · {packs.length} {packs.length === 1 ? "release" : "releases"}</p><h1 id="project-title">{projectName}</h1><p className="detail-package">@{namespace}</p><p className="detail-lede">{project?.description || "Published knowledge available to browse and install through the Hub."}</p></div><div className="detail-version"><span>Published packages</span><strong>{packs.length}</strong><small>Public registry releases</small></div></div></section>
    <section className="catalog" aria-labelledby="project-releases-title"><div className="section-heading"><div><p className="eyebrow">Project releases</p><h2 id="project-releases-title">Knowledge made available.</h2></div><p>Every package is versioned, validated, and linked to its distribution endpoint.</p></div>{packs.map((pack, index) => <article className="pack-card" key={`${pack.id}@${pack.version}`}><div className="pack-number">{String(index + 1).padStart(2, "0")}</div><div className="pack-main"><div className="pack-title-row"><h3>{pack.id}</h3><span className="status"><i /> {pack.verified ? "verified" : "published"}</span></div><p>{pack.description || "Versioned knowledge package."}</p><div className="pack-meta"><span>v{pack.version}</span><span>Schema {pack.schemaVersion}</span><span>{pack.distribution.kind}</span></div></div><a className="pack-arrow" href={`/packs/${namespace}/${pack.id.split("/")[1]}`} aria-label={`View ${pack.id} details`}>↗</a></article>)}</section>
    <section className="install" aria-labelledby="project-install-title"><div><p className="eyebrow">From project to companion</p><h2 id="project-install-title">Choose the knowledge your companion needs.</h2><p>Open a package to inspect its sources, capabilities, version, and installation details.</p></div><div className="install-code"><span className="code-label">PUBLIC PROJECT</span><code><b>publisher</b>: @{namespace}<br /><b>releases</b>: {packs.length}<br /><b>status</b>: public</code><span className="code-caption">The Hub keeps project discovery separate from private publisher controls.</span></div></section>
    <footer><span>© 2026 E Knowledge Hub</span><span>Protocol by <a href="https://github.com/vxnuslabs/e">@vxnus/e</a></span></footer>
  </main>;
}

export default PublicProjectPage;
