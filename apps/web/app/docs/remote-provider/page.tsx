import Link from "next/link";
import "../docs.css";

export const metadata = { title: "Remote providers · E Knowledge Hub Docs", description: "Connect a hosted E knowledge provider to the Knowledge Hub." };

const manifest = [
  "{",
  '  "id": "@vxnus/teyvat",',
  '  "name": "teyvat",',
  '  "publisher": "vxnus",',
  '  "version": "1.0.0",',
  '  "schemaVersion": "1.0",',
  '  "license": { "license": "CC-BY-4.0", "licenseName": "Creative Commons Attribution 4.0 International", "licenseUrl": "https://creativecommons.org/licenses/by/4.0/" },',
  '  "sources": [{ "id": "teyvat", "title": "Teyvat Archive", "license": "CC-BY-4.0", "licenseUrl": "https://creativecommons.org/licenses/by/4.0/" }],',
  '  "capabilities": { "lexicalSearch": false, "semanticSearch": false, "structuredEntities": true, "relations": true, "revisions": true },',
  '  "apiContract": { "openapi": "3.1.0", "paths": { "/api/entities": { "get": {} } } }',
  "}"
].join("\n");

const retrieve = [
  "POST /retrieve", "content-type: application/json", "", "{", '  "query": "Who is the traveler?",', '  "mode": "lexical",', '  "limit": 5', "}", "", "200 OK", "{", '  "revision": "r42",', '  "results": [{', '    "id": "chunk-001",', '    "content": "The Traveler journeys across Teyvat.",', '    "revision": "r42",', '    "citations": [{ "sourceId": "teyvat", "documentId": "traveler", "chunkId": "chunk-001" }]', "  }]", "}"
].join("\n");

const sdkExample = [
  'import { createKnowledgeProvider } from "@vxnus/e-provider";',
  "",
  "export const provider = createKnowledgeProvider({",
  '  identity: { id: "@vxnus/teyvat", publisher: "vxnus" },',
  "  verificationKey: process.env.E_PUBLISHER_API_KEY!,",
  "  // Optional: retrieve: async (request) => searchKnowledge(request.query),",
  "});",
  "",
  "// Handle verification handshake from E Hub",
  "provider.handlers.verify(request.headers.authorization);"
].join("\n");

export default function RemoteProviderDocsPage() {
  return <main className="docs-page">
    <nav className="site-nav docs-nav" aria-label="Primary navigation"><Link className="brand" href="/"><span className="brand-mark">E</span> knowledge hub</Link><div className="nav-links"><Link className="docs-nav-active" href="/docs">Docs</Link><Link href="/#catalog">Catalog</Link><Link href="/publish">Publish</Link><Link className="nav-button" href="/auth/sign-up">Create account</Link></div></nav>
    <div className="docs-layout"><aside className="docs-sidebar"><Link className="back-link" href="/docs">← All docs</Link><p className="docs-sidebar-label">On this page</p><nav><a href="#quickstart">Quick start</a><a href="#sdk">SDK</a><a href="#endpoints">Endpoints</a><a href="#manifest">Manifest & Hub</a><a href="#retrieve">Custom APIs & Search</a><a href="#errors">Errors</a></nav></aside>
      <article className="docs-article"><p className="eyebrow">Remote provider</p><h1>Connect your knowledge where it lives.</h1><p className="docs-article-lede">Give the Hub a public HTTPS URL and a one-time verification key. Project metadata and manifest are managed centrally on the Hub.</p>
        <section id="quickstart" className="docs-block"><h2>Quick start</h2><div className="docs-steps"><div><b>01</b><h3>Expose /verify</h3><p>Expose <code>POST /verify</code> on your provider to establish cryptographic ownership with the Hub.</p></div><div><b>02</b><h3>Configure Manifest in Hub</h3><p>Define your license, sources, capabilities, and OpenAPI contract in your Hub project workspace.</p></div><div><b>03</b><h3>Verify & Publish</h3><p>Generate a one-time <code>E_PUBLISHER_API_KEY</code>, set it in your provider, and click Verify and publish.</p></div></div></section>
        <section id="sdk" className="docs-block"><h2>Use the provider SDK</h2><p><code>@vxnus/e-provider</code> handles ownership verification and optional search validation. Remote providers do NOT need to serve a manifest endpoint.</p><pre><code>{sdkExample}</code></pre></section>
        <section id="endpoints" className="docs-block"><h2>Endpoints & Architecture</h2><p>Only the verification endpoint is private. Providers do not serve <code>/manifest</code>. Consumers interact with your custom REST/RPC endpoints or optional <code>/retrieve</code>.</p><div className="endpoint-list"><div><code>POST /verify</code><span><b>MANDATORY:</b> Private ownership check using the Hub-supplied Bearer key.</span></div><div><code>POST /retrieve</code><span><b>OPTIONAL:</b> Standard E cited search results.</span></div><div><code>Custom APIs</code><span><b>FLEXIBLE:</b> Any custom endpoints documented in your project OpenAPI contract.</span></div></div></section>
        <section id="manifest" className="docs-block"><h2>Authoritative Hub Manifest</h2><p>Manifest metadata, licensing, sources, and capability declarations are created and edited in your project settings on E Hub, stored immutably in the registry.</p><pre><code>{manifest}</code></pre></section>
        <section id="retrieve" className="docs-block"><h2>Optional Retrieval Response</h2><p>If you implement standard <code>POST /retrieve</code>, results must include a revision and citations back to source records.</p><pre><code>{retrieve}</code></pre></section>
        <section id="errors" className="docs-block docs-errors"><h2>Verification rules</h2><div className="error-grid"><div><code>401</code><h3>Invalid key</h3><p>The key is missing, revoked, or incorrect.</p></div><div><code>403</code><h3>Wrong provider</h3><p>The key is valid but belongs to another provider identity.</p></div><div><code>400</code><h3>Invalid contract</h3><p>The OpenAPI contract or provider URL does not meet the E contract.</p></div></div><p className="docs-note">The Hub stores the public URL, verification state, and project manifest. Never include the private key in a client bundle or log.</p></section>
        <div className="docs-article-cta"><div><strong>Ready to publish?</strong><span>Create a project and configure your manifest in the Hub workspace.</span></div><Link className="button button-primary" href="/publish">Open publisher workspace ↗</Link></div>
      </article>
    </div>
    <footer><span>© 2026 E Knowledge Hub</span><span>Protocol by <a href="https://github.com/vxnuslabs/e">@vxnus/e</a></span></footer>
  </main>;
}
