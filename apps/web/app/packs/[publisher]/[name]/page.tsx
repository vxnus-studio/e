import { notFound } from "next/navigation";

const pack = {
  publisher: "vxnus",
  name: "siduri-basics",
  packageName: "@vxnus/siduri-basics",
  displayName: "Siduri Basics",
  version: "0.1.0",
  revision: "r1",
  description: "A tiny knowledge pack used to verify Siduri installation.",
  source: "Siduri Handbook",
  sourceId: "siduri-handbook",
  license: "CC0-1.0",
  hash: "db6338c160c3691c82bb6f7dcca078fcbe9dddb51512aff06c5a73f777a75386",
  capabilities: ["Lexical search", "Revisions"],
  fact: "Siduri is a persistent companion runtime.",
};

export function generateStaticParams() { return [{ publisher: pack.publisher, name: pack.name }]; }

export default async function PackPage({ params }: { params: Promise<{ publisher: string; name: string }> }) {
  const { publisher, name } = await params;
  if (`@${publisher}/${name}` !== pack.packageName) notFound();

  return <main className="detail-page">
    <nav className="site-nav" aria-label="Primary navigation"><a className="brand" href="/"><span className="brand-mark">E</span> knowledge hub</a><div className="nav-links"><a href="/#catalog">Catalog</a><a href="/#publish">Publish</a><a className="nav-button" href="/#install">Use with Siduri</a></div></nav>
    <section className="detail-hero" aria-labelledby="pack-title"><a className="back-link" href="/#catalog">← Back to catalog</a><div className="detail-heading"><div><p className="eyebrow">Knowledge package · verified</p><h1 id="pack-title">{pack.displayName}</h1><p className="detail-package">{pack.packageName}</p><p className="detail-lede">{pack.description}</p></div><div className="detail-version"><span>Current release</span><strong>v{pack.version}</strong><small>Revision {pack.revision}</small></div></div></section>
    <section className="detail-content" aria-label="Pack information"><div className="detail-main"><p className="eyebrow">What is inside</p><h2>One grounded fact,<br />ready to retrieve.</h2><blockquote>“{pack.fact}”</blockquote><p className="citation">Source: {pack.source} · {pack.sourceId} · {pack.license}</p></div><aside className="detail-aside"><div className="detail-block"><span className="detail-label">Publisher</span><strong>@{pack.publisher}</strong></div><div className="detail-block"><span className="detail-label">Capabilities</span><div className="capability-list">{pack.capabilities.map((capability) => <span key={capability}>{capability}</span>)}</div></div><div className="detail-block"><span className="detail-label">Content hash</span><code>{pack.hash}</code></div></aside></section>
    <section className="detail-install" aria-labelledby="detail-install-title"><div><p className="eyebrow">Install locally</p><h2 id="detail-install-title">Put this pack<br />in Siduri.</h2><p>Download or copy the pack directory, then point Siduri at its local path.</p></div><div className="install-code"><span className="code-label">SIDURI CONFIG</span><code><b>knowledge</b>:<br />  provider: e-knowledge<br />  packPath: ./siduri-basics</code><span className="code-caption">Siduri validates the manifest before use.</span></div></section>
    <footer><span>© 2026 E Knowledge Hub</span><span>Protocol by <a href="https://github.com/vxnuslabs/e">@vxnus/e</a></span></footer>
  </main>;
}
