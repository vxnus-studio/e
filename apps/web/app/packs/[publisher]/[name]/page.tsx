/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import { registry } from "@/lib/registry";
import { CatalogRefresh } from "@/app/catalog-refresh";

export default async function PackPage({ params }: { params: Promise<{ publisher: string; name: string }> }) {
  const { publisher, name } = await params;
  const pack = await registry.get(`@${publisher}/${name}`);
  if (!pack) notFound();
  const capabilities = Object.entries(pack.capabilities).filter(([, enabled]) => enabled).map(([capability]) => capability);
  const license = pack.license;
  const embedding = pack.retrieval?.embedding;

  return (
    <main className="detail-page">
      <CatalogRefresh />
      <nav className="site-nav" aria-label="Primary navigation">
        <a className="brand" href="/">
          <span className="brand-mark">E</span> Hub
        </a>
        <div className="nav-links">
          <a href="/catalog">Catalog</a>
          <a href="/docs">Docs</a>
          <a href="/publish">Publish</a>
          <a className="nav-button" href="/publish">Publish a pack</a>
        </div>
      </nav>

      <section className="detail-hero" aria-labelledby="pack-title">
        <a className="back-link" href="/catalog">← Back to catalog</a>
        <div className="detail-heading">
          <div>
            <p className="eyebrow">
              Knowledge capability · {pack.verified ? "verified" : "unverified"} ·{" "}
              <span style={{ textTransform: "uppercase", fontWeight: 600 }}>
                {pack.distributionType === "both"
                  ? "Local & Remote"
                  : pack.distributionType === "remote"
                  ? "Remote Provider"
                  : "Local Archive"}
              </span>
            </p>
            <h1 id="pack-title">{pack.name}</h1>
            <p className="detail-package">{pack.id}</p>
            <p className="detail-lede">{pack.description}</p>
          </div>
          <div className="detail-version">
            <span>Current release</span>
            <strong>v{pack.version}</strong>
            <small>Schema {pack.schemaVersion}</small>
          </div>
        </div>
      </section>

      <section className="detail-content" aria-label="Pack information">
        <div className="detail-main">
          <p className="eyebrow">What is inside</p>
          <h2>Versioned knowledge,<br />ready to retrieve.</h2>
          <blockquote>Install this cited pack into any E-compatible AI and retrieve its grounded content locally or remotely.</blockquote>
          
          <div style={{ marginTop: 24 }}>
            <span className="detail-label" style={{ display: "block", marginBottom: 8 }}>Knowledge Sources ({pack.sources.length})</span>
            {pack.sources.map((src) => (
              <p className="citation" key={src.id} style={{ marginBottom: 8 }}>
                Source: <strong>{src.title}</strong> · <code>{src.id}</code> · {src.license}
                {src.uri && (
                  <>
                    {" · "}
                    <a href={src.uri} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}>
                      Upstream repository ↗
                    </a>
                  </>
                )}
              </p>
            ))}
          </div>

          {license?.notice && (
            <div style={{ marginTop: 24, background: "#eef1eb", border: "1px solid #dce2db", padding: 16 }}>
              <span className="detail-label" style={{ display: "block", marginBottom: 6 }}>Provenance & Rights Notice</span>
              <p className="citation" style={{ margin: 0 }}>{license.notice}</p>
            </div>
          )}
        </div>

        <aside className="detail-aside">
          <div className="detail-block">
            <span className="detail-label">Publisher</span>
            <strong>{pack.publisher}</strong>
          </div>

          <div className="detail-block">
            <span className="detail-label">License</span>
            <strong>
              {license?.licenseUrl ? (
                <a href={license.licenseUrl} target="_blank" rel="noreferrer">
                  {license.licenseName || license.license}
                </a>
              ) : (
                license?.licenseName || pack.sources[0]?.license || "Open"
              )}
            </strong>
            {license?.rightsHolder && <small>Rights holder: {license.rightsHolder}</small>}
            {license?.copyrightNotice && <small>{license.copyrightNotice}</small>}
            {license?.attributionText && <small>Attribution: {license.attributionText}</small>}
          </div>

          <div className="detail-block">
            <span className="detail-label">Capabilities</span>
            <div className="capability-list">
              {capabilities.map((capability) => (
                <span key={capability}>{capability}</span>
              ))}
            </div>
          </div>

          {embedding && (
            <div className="detail-block">
              <span className="detail-label">Semantic Embedding</span>
              <strong>{embedding.provider} / {embedding.model}</strong>
              <small>{embedding.dimensions} dimensions</small>
            </div>
          )}

          {(pack.distributions || [pack.distribution]).map((dist, i) => (
            <div className="detail-block" key={`${dist.kind}-${i}`}>
              <span className="detail-label">
                {dist.kind === "provider" ? "Remote Distribution Endpoint" : "Local Archive"}
              </span>
              <code>{dist.url}</code>
              {dist.checksum && <small>SHA-256: {dist.checksum}</small>}
            </div>
          ))}
        </aside>
      </section>

      <footer>
        <span>© 2026 E Hub</span>
        <span>Protocol by <a href="https://github.com/vxnus-studio/e">@vxnus/e</a></span>
      </footer>
    </main>
  );
}
