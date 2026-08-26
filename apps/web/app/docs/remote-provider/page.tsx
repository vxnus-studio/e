import Link from "next/link";
import "../docs.css";

export const metadata = { title: "Remote providers · E Knowledge Hub Docs", description: "Connect a hosted E knowledge provider to the Knowledge Hub." };

const manifest = [
  "{",
  '  "id": "@vxnus/e-teyvat",',
  '  "name": "e-teyvat",',
  '  "publisher": "vxnus",',
  '  "version": "1.0.1",',
  '  "schemaVersion": "1.0",',
  '  "license": { "license": "CC-BY-4.0", "licenseName": "Creative Commons Attribution 4.0 International", "licenseUrl": "https://creativecommons.org/licenses/by/4.0/" },',
  '  "sources": [{ "id": "teyvat", "title": "Teyvat Archive", "license": "CC-BY-4.0", "licenseUrl": "https://creativecommons.org/licenses/by/4.0/" }],',
  '  "capabilities": { "lexicalSearch": true, "semanticSearch": true, "structuredEntities": true, "relations": true, "revisions": true },',
  '  "apiContract": { "openapi": "3.1.0", "paths": { "/api/entities": { "get": {} }, "/api/farming": { "get": {} } } }',
  "}"
].join("\n");

const openapiSpec = [
  "{",
  '  "openapi": "3.1.0",',
  '  "info": { "title": "E-Teyvat Knowledge API", "version": "1.0.0" },',
  '  "paths": {',
  '    "/api/entities": { "get": { "summary": "Search game entities" } },',
  '    "/api/farming": { "get": { "summary": "Farming source locations" } }',
  "  }",
  "}"
].join("\n");

const sdkExample = [
  'import { createKnowledgeProvider } from "@vxnus/e-provider";',
  "",
  "export const provider = createKnowledgeProvider({",
  '  identity: { id: "@vxnus/e-teyvat", publisher: "vxnus" },',
  "  verificationKey: process.env.E_PUBLISHER_API_KEY!,",
  "  // Optional: retrieve: async (request) => searchKnowledge(request.query),",
  "});",
  "",
  "// Handle verification handshake from E Hub at /api/e/verify or /verify",
  "provider.handlers.verify(request.headers.authorization);"
].join("\n");

export default function RemoteProviderDocsPage() {
  return <main className="docs-page">
    <nav className="site-nav docs-nav" aria-label="Primary navigation"><Link className="brand" href="/"><span className="brand-mark">E</span> knowledge hub</Link><div className="nav-links"><Link className="docs-nav-active" href="/docs">Docs</Link><Link href="/#catalog">Catalog</Link><Link href="/publish">Publish</Link><Link className="nav-button" href="/auth/sign-up">Create account</Link></div></nav>
    <div className="docs-layout"><aside className="docs-sidebar"><Link className="back-link" href="/docs">← All docs</Link><p className="docs-sidebar-label">On this page</p><nav><a href="#quickstart">Quick start</a><a href="#sdk">SDK</a><a href="#endpoints">Endpoints & Discovery</a><a href="#openapi">OpenAPI Contract</a><a href="#manifest">Authoritative Hub Manifest</a><a href="#errors">Verification Rules</a></nav></aside>
      <article className="docs-article"><p className="eyebrow">Remote provider</p><h1>Connect your knowledge where it lives.</h1><p className="docs-article-lede">Give the Hub a Base URL and a one-time verification key. Project metadata and manifest are managed centrally on the Hub, with automatic OpenAPI discovery.</p>
        <section id="quickstart" className="docs-block"><h2>Quick start</h2><div className="docs-steps"><div><b>01</b><h3>Expose /verify</h3><p>Expose <code>POST /api/e/verify</code> (or <code>/verify</code>) on your server with your <code>E_PUBLISHER_API_KEY</code>.</p></div><div><b>02</b><h3>Expose OpenAPI or /retrieve</h3><p>Host your API spec at <code>GET /api/openapi.json</code> or implement standard <code>POST /retrieve</code>.</p></div><div><b>03</b><h3>Verify & Publish</h3><p>Enter your Base URL in the publisher workspace and click Verify and publish.</p></div></div></section>
        <section id="sdk" className="docs-block"><h2>Use the provider SDK</h2><p><code>@vxnus/e-provider</code> handles ownership verification and optional search validation. Remote providers do NOT host manifests—the Hub manages authoritative pack metadata.</p><pre><code>{sdkExample}</code></pre></section>
        <section id="endpoints" className="docs-block"><h2>Endpoints & Smart Discovery</h2><p>When you provide a Base URL (e.g. <code>https://eteyvat.vxnus.xyz</code>), E Hub verifies your provider and discovers endpoints automatically:</p><div className="endpoint-list"><div><code>POST /api/e/verify</code><span><b>MANDATORY:</b> Handshake verifying your <code>E_PUBLISHER_API_KEY</code> (also supports <code>/verify</code>).</span></div><div><code>GET /api/openapi.json</code><span><b>RECOMMENDED:</b> Auto-discovered OpenAPI specification describing your custom endpoints.</span></div><div><code>POST /api/e/retrieve</code><span><b>OPTIONAL:</b> Standard E lexical/semantic search (required if no OpenAPI contract is provided).</span></div></div></section>
        <section id="openapi" className="docs-block"><h2>OpenAPI Specification</h2><p>Serving an OpenAPI spec at <code>/api/openapi.json</code> allows AI agents (like Siduri) to automatically discover and call your custom knowledge endpoints.</p><pre><code>{openapiSpec}</code></pre></section>
        <section id="manifest" className="docs-block"><h2>Authoritative Hub Manifest</h2><p>Manifest metadata, licensing, sources, and capability declarations are created and edited in your project settings on E Hub, stored immutably in the registry.</p><pre><code>{manifest}</code></pre></section>
        <section id="errors" className="docs-block docs-errors"><h2>Verification rules</h2><div className="error-grid"><div><code>401</code><h3>Invalid key</h3><p>The key is missing, revoked, or incorrect.</p></div><div><code>403</code><h3>Wrong provider</h3><p>The key is valid but belongs to another provider identity.</p></div><div><code>400</code><h3>Inaccessible Knowledge</h3><p>The provider must expose either a working <code>POST /retrieve</code> or an OpenAPI contract.</p></div></div><p className="docs-note">The Hub stores the public URL, verification state, and project manifest. Never include the private key in a client bundle or log.</p></section>
        <div className="docs-article-cta"><div><strong>Ready to publish?</strong><span>Create a project and configure your manifest in the Hub workspace.</span></div><Link className="button button-primary" href="/publish">Open publisher workspace ↗</Link></div>
      </article>
    </div>
    <footer><span>© 2026 E Knowledge Hub</span><span>Protocol by <a href="https://github.com/vxnuslabs/e">@vxnus/e</a></span></footer>
  </main>;
}
