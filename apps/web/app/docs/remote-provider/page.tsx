import Link from "next/link";
import "../docs.css";

export const metadata = { title: "Remote providers · E Knowledge Hub Docs", description: "Connect a hosted E knowledge provider to the Knowledge Hub." };

const manifest = [
  "{", '  "id": "@acme/teyvat",', '  "name": "Teyvat Knowledge",', '  "publisher": "acme",', '  "version": "1.0.0",', '  "schemaVersion": "1.0",', '  "license": { "license": "CC-BY-4.0", "licenseName": "Creative Commons Attribution 4.0 International", "licenseUrl": "https://creativecommons.org/licenses/by/4.0/" },', '  "sources": [{ "id": "handbook", "title": "Official Handbook", "license": "CC-BY-4.0", "licenseDescription": "Creative Commons Attribution 4.0 International", "licenseUrl": "https://creativecommons.org/licenses/by/4.0/" }],', '  "capabilities": { "lexicalSearch": true, "semanticSearch": false, "structuredEntities": true, "relations": true, "revisions": true }', "}"
].join("\n");
const retrieve = [
  "POST /retrieve", "content-type: application/json", "", "{", '  "query": "Who is the traveler?",', '  "mode": "lexical",', '  "limit": 5', "}", "", "200 OK", "{", '  "revision": "r42",', '  "results": [{', '    "id": "chunk-001",', '    "content": "The Traveler journeys across Teyvat.",', '    "revision": "r42",', '    "citations": [{ "sourceId": "handbook", "documentId": "traveler", "chunkId": "chunk-001" }]', "  }]", "}"
].join("\n");
const sdkExample = [
  'import { createKnowledgeProvider } from "@vxnus/e-provider";',
  "", 
  "export const provider = createKnowledgeProvider({",
  "  manifest,",
  "  verificationKey: process.env.E_PUBLISHER_API_KEY!,",
  "  retrieve: async (request) => searchKnowledge(request.query),",
  "});",
  "",
  "provider.handlers.manifest();",
  "provider.handlers.retrieve(requestBody);",
  "provider.handlers.verify(request.headers.authorization);"
].join("\n");

export default function RemoteProviderDocsPage() {
  return <main className="docs-page">
    <nav className="site-nav docs-nav" aria-label="Primary navigation"><Link className="brand" href="/"><span className="brand-mark">E</span> knowledge hub</Link><div className="nav-links"><Link className="docs-nav-active" href="/docs">Docs</Link><Link href="/#catalog">Catalog</Link><Link href="/publish">Publish</Link><Link className="nav-button" href="/auth/sign-up">Create account</Link></div></nav>
    <div className="docs-layout"><aside className="docs-sidebar"><Link className="back-link" href="/docs">← All docs</Link><p className="docs-sidebar-label">On this page</p><nav><a href="#quickstart">Quick start</a><a href="#sdk">SDK</a><a href="#endpoints">Endpoints</a><a href="#manifest">Manifest</a><a href="#retrieve">Retrieval</a><a href="#errors">Errors</a></nav></aside>
      <article className="docs-article"><p className="eyebrow">Remote provider</p><h1>Connect your knowledge where it lives.</h1><p className="docs-article-lede">Give the Hub a public HTTPS URL and a one-time verification key. The Hub handles the registry metadata for you.</p>
        <section id="quickstart" className="docs-block"><h2>Quick start</h2><div className="docs-steps"><div><b>01</b><h3>Expose the contract</h3><p>Serve <code>/manifest</code>, <code>/retrieve</code>, and <code>/verify</code> from one HTTPS base URL.</p></div><div><b>02</b><h3>Generate a key</h3><p>Use the Hub publisher workspace to generate a one-time <code>E_PUBLISHER_API_KEY</code> snippet.</p></div><div><b>03</b><h3>Connect once</h3><p>Set the key in your provider environment, then click Verify and publish. The Hub never stores it.</p></div></div></section>
        <section id="sdk" className="docs-block"><h2>Use the provider SDK</h2><p><code>@vxnus/e-provider</code> validates the manifest, retrieval request, retrieval response, and verification key behavior. Your application only supplies the search function.</p><pre><code>{sdkExample}</code></pre></section>
        <section id="endpoints" className="docs-block"><h2>Three endpoints</h2><p>Only the verification endpoint is private. Consumers use the other two without credentials.</p><div className="endpoint-list"><div><code>GET /manifest</code><span>Public package identity, sources, capabilities, and version.</span></div><div><code>POST /retrieve</code><span>Public cited results for a retrieval request.</span></div><div><code>POST /verify</code><span>Private ownership check using the Hub-supplied Bearer key.</span></div></div></section>
        <section id="manifest" className="docs-block"><h2>Manifest response</h2><p>Return a valid E manifest. The <code>id</code> and <code>publisher</code> must match the Hub project.</p><pre><code>{manifest}</code></pre></section>
        <section id="retrieve" className="docs-block"><h2>Retrieval response</h2><p>Results must include a revision and citations back to the source record.</p><pre><code>{retrieve}</code></pre></section>
        <section id="errors" className="docs-block docs-errors"><h2>Verification rules</h2><div className="error-grid"><div><code>401</code><h3>Invalid key</h3><p>The key is missing, revoked, or incorrect.</p></div><div><code>403</code><h3>Wrong provider</h3><p>The key is valid but belongs to another provider identity.</p></div><div><code>400</code><h3>Invalid contract</h3><p>The manifest or provider URL does not meet the E contract.</p></div></div><p className="docs-note">The Hub stores the public URL and verification state. Never include the key in a manifest, response, client bundle, or log.</p></section>
        <div className="docs-article-cta"><div><strong>Ready to publish?</strong><span>Connect your provider from the Hub workspace.</span></div><Link className="button button-primary" href="/publish">Open publisher workspace ↗</Link></div>
      </article>
    </div>
    <footer><span>© 2026 E Knowledge Hub</span><span>Protocol by <a href="https://github.com/vxnuslabs/e">@vxnus/e</a></span></footer>
  </main>;
}
