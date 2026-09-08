import Link from "next/link";
import "./docs.css";

export const metadata = { title: "Documentation · E Hub", description: "Technical documentation for building and publishing capabilities on E Hub." };

const manifestExample = [
  "{", '  "id": "@acme/teyvat",', '  "publisher": "acme",', '  "version": "1.0.0",', '  "schemaVersion": "1.0",', '  "license": { "license": "CC-BY-4.0", "licenseName": "Creative Commons Attribution 4.0 International", "licenseUrl": "https://creativecommons.org/licenses/by/4.0/" },', '  "sources": [...],', '  "capabilities": {', '    "lexicalSearch": true,', '    "semanticSearch": false,', '    "structuredEntities": true,', '    "relations": true,', '    "revisions": true', "  }", "}"
].join("\n");

export default function DocsPage() {
  return <main className="docs-page">
    <nav className="site-nav docs-nav" aria-label="Primary navigation"><Link className="brand" href="/"><span className="brand-mark">E</span> Hub</Link><div className="nav-links"><Link className="docs-nav-active" href="/docs">Docs</Link><Link href="/catalog">Catalog</Link><Link href="/publish">Publish</Link><Link className="nav-button" href="/auth/sign-up">Create account</Link></div></nav>
    <section className="docs-hero"><div><p className="eyebrow">Technical documentation</p><h1>Build for E Hub<br />without the maze.</h1><p className="docs-lede">E Hub is the open capability layer for E-compatible AI. Build, publish, and verify modular capabilities, starting with versioned knowledge packs.</p></div><div className="docs-hero-index"><span>01</span><p>Capability focus:<br />Knowledge packs.</p></div></section>
    <section className="docs-overview" aria-labelledby="docs-overview-title"><div className="docs-section-intro"><p className="eyebrow">Capability overview</p><h2 id="docs-overview-title">Knowledge as a capability.</h2><p>Knowledge packs give E-compatible AI verified facts and citations. Deliver knowledge through portable local archives or hosted remote providers.</p></div><div className="docs-paths"><Link className="docs-path" href="/docs/remote-provider"><span className="docs-path-number">01</span><div><h3>Remote provider</h3><p>Keep your data where it is. Give the Hub a public provider URL and prove ownership once.</p><span className="docs-path-link">Read the provider guide ↗</span></div></Link><Link className="docs-path" href="/docs/local-archive"><span className="docs-path-number">02</span><div><h3>Local archive</h3><p>Package a validated E directory as a <code>.tar.gz</code> file. The Hub stores the immutable archive and its checksum.</p><span className="docs-path-link">Read the archive guide ↗</span></div></Link></div></section>
    <section className="docs-contract" aria-labelledby="contract-title"><div><p className="eyebrow">The contract</p><h2 id="contract-title">A manifest at the center.</h2><p>Every published release starts with a manifest. It identifies the package, declares capabilities, and points consumers to cited, revision-aware knowledge.</p></div><pre><code>{manifestExample}</code></pre></section>
    <section className="docs-next" aria-label="Next steps"><p className="eyebrow">Start here</p><div><h2>Ready to connect a provider?</h2><Link className="button button-primary" href="/docs/remote-provider">Open remote guide <span aria-hidden="true">↗</span></Link></div></section>
    <footer><span>© 2026 E Hub</span><span>Protocol by <a href="https://github.com/vxnus-studio/e">@vxnus/e</a></span></footer>
  </main>;
}
