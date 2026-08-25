import Link from "next/link";
import "../docs.css";

export const metadata = { title: "Local archives · E Knowledge Hub Docs", description: "Build, validate, and publish a local E knowledge archive." };

const tree = [
  "knowledge-pack/",
  "├── manifest.json",
  "├── sources/",
  "├── documents/",
  "├── chunks/",
  "├── entities/",
  "├── relations/",
  "└── revisions/"
].join("\n");

const commands = [
  "# Validate the pack before publishing",
  "npx @vxnus/e-knowledge ./knowledge-pack",
  "",
  "# Create an archive without changing record bytes",
  "tar -czf teyvat-1.0.0.tar.gz -C knowledge-pack .",
  "",
  "# Check the archive locally",
  "sha256sum teyvat-1.0.0.tar.gz"
].join("\n");

export default function LocalArchiveDocsPage() {
  return <main className="docs-page">
    <nav className="site-nav docs-nav" aria-label="Primary navigation"><Link className="brand" href="/"><span className="brand-mark">E</span> knowledge hub</Link><div className="nav-links"><Link className="docs-nav-active" href="/docs">Docs</Link><Link href="/#catalog">Catalog</Link><Link href="/publish">Publish</Link><Link className="nav-button" href="/auth/sign-up">Create account</Link></div></nav>
    <div className="docs-layout"><aside className="docs-sidebar"><Link className="back-link" href="/docs">← All docs</Link><p className="docs-sidebar-label">On this page</p><nav><a href="#quickstart">Quick start</a><a href="#structure">Pack structure</a><a href="#validate">Validate</a><a href="#publish">Publish</a><a href="#install">Install</a></nav></aside>
      <article className="docs-article"><p className="eyebrow">Local archive</p><h1>Ship a portable pack.</h1><p className="docs-article-lede">Build knowledge as a self-contained directory, validate it locally, then upload one immutable archive to the Hub.</p>
        <section id="quickstart" className="docs-block"><h2>Quick start</h2><div className="docs-steps"><div><b>01</b><h3>Build the directory</h3><p>Keep normalized public records under the standard E directories and give every record a stable <code>id</code>.</p></div><div><b>02</b><h3>Validate locally</h3><p>Run the E validator before archiving. It checks references, revisions, and content hashes.</p></div><div><b>03</b><h3>Upload once</h3><p>Choose <strong>Local file</strong> in the publisher workspace and upload a <code>.tar.gz</code> or <code>.tgz</code>.</p></div></div></section>
        <section id="structure" className="docs-block"><h2>Pack structure</h2><p>A pack is portable because the manifest and records travel together. The manifest identity must use the <code>@publisher/name</code> format.</p><pre><code>{tree}</code></pre></section>
        <section id="validate" className="docs-block"><h2>Validate and archive</h2><p>The validator reads the directory before the Hub sees it. Keep archive creation reproducible and do not rewrite record bytes after validation.</p><pre><code>{commands}</code></pre></section>
        <section id="publish" className="docs-block"><h2>What the Hub does</h2><div className="endpoint-list"><div><code>01 · Inspect</code><span>Checks the archive type, size, safe paths, manifest, records, references, and revision content hash.</span></div><div><code>02 · Fingerprint</code><span>Calculates a SHA-256 checksum for the exact uploaded archive.</span></div><div><code>03 · Distribute</code><span>Stores the archive in R2 and records its public URL, checksum, release, and audit event.</span></div></div><p className="docs-note">The archive is immutable by package and version. Publish a new version when public content changes.</p></section>
        <section id="install" className="docs-block"><h2>Install in Siduri</h2><p>After publication, Siduri discovers the archive through the registry and validates it again before exposing it to the runtime.</p><pre><code>{[
          "GET https://e.vxnus.xyz/api/packs/acme/teyvat?version=1.0.0",
          "",
          "distribution.kind: archive",
          "distribution.url: https://knowledge.e.vxnus.xyz/...",
          "distribution.checksum: sha256:..."
        ].join("\n")}</code></pre></section>
        <div className="docs-article-cta"><div><strong>Ready to upload?</strong><span>Build a project, then publish from the workspace.</span></div><Link className="button button-primary" href="/publish">Open publisher workspace ↗</Link></div>
      </article>
    </div>
    <footer><span>© 2026 E Knowledge Hub</span><span>Protocol by <a href="https://github.com/vxnuslabs/e">@vxnus/e</a></span></footer>
  </main>;
}
