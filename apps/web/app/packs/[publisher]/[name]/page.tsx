/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import { registry } from "@/lib/registry";

export default async function PackPage({ params }: { params: Promise<{ publisher: string; name: string }> }) {
  const { publisher, name } = await params;
  const pack = await registry.get(`@${publisher}/${name}`);
  if (!pack) notFound();
  const capabilities = Object.entries(pack.capabilities).filter(([, enabled]) => enabled).map(([capability]) => capability);

  return <main className="detail-page">
    <nav className="site-nav" aria-label="Primary navigation"><a className="brand" href="/"><span className="brand-mark">E</span> knowledge hub</a><div className="nav-links"><a href="/#catalog">Catalog</a><a href="/#publish">Publish</a><a className="nav-button" href="/#install">Use with Siduri</a></div></nav>
    <section className="detail-hero" aria-labelledby="pack-title"><a className="back-link" href="/#catalog">← Back to catalog</a><div className="detail-heading"><div><p className="eyebrow">Knowledge package · {pack.verified ? "verified" : "unverified"}</p><h1 id="pack-title">{pack.name}</h1><p className="detail-package">{pack.id}</p><p className="detail-lede">{pack.description}</p></div><div className="detail-version"><span>Current release</span><strong>v{pack.version}</strong><small>Schema {pack.schemaVersion}</small></div></div></section>
    <section className="detail-content" aria-label="Pack information"><div className="detail-main"><p className="eyebrow">What is inside</p><h2>Versioned knowledge,<br />ready to retrieve.</h2><blockquote>Install this cited pack into Siduri and retrieve its grounded content locally.</blockquote><p className="citation">Source: {pack.sources[0].title} · {pack.sources[0].id} · {pack.sources[0].license}</p></div><aside className="detail-aside"><div className="detail-block"><span className="detail-label">Publisher</span><strong>{pack.publisher}</strong></div><div className="detail-block"><span className="detail-label">Capabilities</span><div className="capability-list">{capabilities.map((capability) => <span key={capability}>{capability}</span>)}</div></div><div className="detail-block"><span className="detail-label">Archive checksum</span><code>{pack.distribution.checksum}</code></div></aside></section>
    <section className="detail-install" aria-labelledby="detail-install-title"><div><p className="eyebrow">Install locally</p><h2 id="detail-install-title">Put this pack<br />in Siduri.</h2><p>Download or copy the pack directory, then point Siduri at its local path.</p></div><div className="install-code"><span className="code-label">SIDURI CONFIG</span><code><b>knowledge</b>:<br />  provider: e-knowledge<br />  packPath: ./knowledge-pack</code><span className="code-caption">Siduri validates the manifest before use.</span></div></section>
    <footer><span>© 2026 E Knowledge Hub</span><span>Protocol by <a href="https://github.com/vxnuslabs/e">@vxnus/e</a></span></footer>
  </main>;
}
