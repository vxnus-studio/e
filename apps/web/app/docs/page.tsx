import Link from "next/link";
import "./docs.css";

export const metadata = { title: "Documentation · E Knowledge Hub", description: "Technical documentation for publishing and consuming E knowledge." };

const manifestExample = [
  "{", '  "id": "@acme/teyvat",', '  "publisher": "acme",', '  "version": "1.0.0",', '  "schemaVersion": "1.0",', '  "sources": [...],', '  "capabilities": {', '    "lexicalSearch": true,', '    "semanticSearch": false,', '    "structuredEntities": true,', '    "relations": true,', '    "revisions": true', "  }", "}"
].join("\n");

export default function DocsPage() {
  return <main className="docs-page">
    <nav className="site-nav docs-nav" aria-label="Primary navigation"><Link className="brand" href="/"><span className="brand-mark">E</span> knowledge hub</Link><div className="nav-links"><Link className="docs-nav-active" href="/docs">Docs</Link><Link href="/#catalog">Catalog</Link><Link href="/publish">Publish</Link><Link className="nav-button" href="/auth/sign-up">Create account</Link></div></nav>
    <section className="docs-hero"><div><p className="eyebrow">Technical documentation</p><h1>Publish knowledge<br />without the maze.</h1><p className="docs-lede">E is the compatibility layer between a knowledge publisher, the Hub registry, and Siduri.</p></div><div className="docs-hero-index"><span>01</span><p>One public contract.<br />Two distribution paths.</p></div></section>
    <section className="docs-overview" aria-labelledby="docs-overview-title"><div className="docs-section-intro"><h2 id="docs-overview-title">Choose how knowledge travels.</h2><p>The content contract stays the same whether Siduri downloads a portable archive or retrieves from your hosted provider.</p></div><div className="docs-paths"><Link className="docs-path" href="/docs/remote-provider"><span className="docs-path-number">01</span><div><h3>Remote provider</h3><p>Keep your data where it is. Give the Hub a public provider URL and prove ownership once.</p><span className="docs-path-link">Read the provider guide ↗</span></div></Link><Link className="docs-path" href="/docs/local-archive"><span className="docs-path-number">02</span><div><h3>Local archive</h3><p>Package a validated E directory as a <code>.tar.gz</code> file. The Hub stores the immutable archive and its checksum.</p><span className="docs-path-link">Read the archive guide ↗</span></div></Link></div></section>
    <section className="docs-contract" aria-labelledby="contract-title"><div><p className="eyebrow">The contract</p><h2 id="contract-title">A manifest at the center.</h2><p>Every published release starts with a manifest. It identifies the package, declares capabilities, and points consumers to cited, revision-aware knowledge.</p></div><pre><code>{manifestExample}</code></pre></section>
    <section className="docs-next" aria-label="Next steps"><p className="eyebrow">Start here</p><div><h2>Ready to connect a provider?</h2><Link className="button button-primary" href="/docs/remote-provider">Open remote guide <span aria-hidden="true">↗</span></Link></div></section>
    <footer><span>© 2026 E Knowledge Hub</span><span>Protocol by <a href="https://github.com/vxnuslabs/e">@vxnus/e</a></span></footer>
  </main>;
}
