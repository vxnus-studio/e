import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { registry } from "@/lib/registry";
import { CatalogRefresh } from "@/app/catalog-refresh";
import { CatalogBrowser } from "./catalog-browser";
import "./catalog.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Knowledge Catalog · E Knowledge Hub",
  description:
    "Browse versioned, cited knowledge packs ready to install into Siduri or query via remote provider.",
};

interface CatalogPageProps {
  searchParams: Promise<{
    q?: string;
    type?: string;
    verified?: string;
    cap?: string;
    sort?: string;
  }>;
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const { packs } = await registry.search({
    query: params.q,
    limit: 100,
  });

  return (
    <main className="catalog-page">
      <CatalogRefresh />

      {/* Navigation */}
      <nav className="site-nav" aria-label="Primary navigation">
        <Link className="brand" href="/">
          <span className="brand-mark">E</span> knowledge hub
        </Link>
        <div className="nav-links">
          <Link href="/docs">Docs</Link>
          <Link className="catalog-nav-active" href="/catalog">
            Catalog
          </Link>
          <Link href="/publish">Publish</Link>
          <Link href="/auth/sign-in">Sign in</Link>
          <Link className="nav-button" href="/auth/sign-up">
            Create account
          </Link>
        </div>
      </nav>

      {/* Hero Header */}
      <section className="catalog-hero" aria-labelledby="catalog-hero-title">
        <div className="catalog-hero-copy">
          <p className="eyebrow">Open Knowledge Catalog</p>
          <h1 id="catalog-hero-title">Knowledge your companion can trust.</h1>
          <p className="catalog-hero-lede">
            Discover versioned, cited knowledge packs built to install cleanly into Siduri. Filter by
            distribution format, provenance verification, and capabilities.
          </p>
        </div>

        <div className="catalog-hero-stats" aria-label="Catalog status">
          <div className="catalog-stat-item">
            <span>Indexed packs</span>
            <strong>{packs.length}</strong>
            <small>Versioned & portable</small>
          </div>
          <div className="catalog-stat-item">
            <span>Format</span>
            <strong>Local + API</strong>
            <small>Siduri compatible</small>
          </div>
        </div>
      </section>

      {/* Interactive Catalog Browser */}
      <Suspense
        fallback={
          <div className="catalog-content">
            <p className="catalog-count-text">Loading catalog...</p>
          </div>
        }
      >
        <CatalogBrowser
          initialPacks={packs}
          initialQuery={params.q}
          initialType={params.type}
          initialVerified={params.verified === "true"}
          initialCapability={params.cap}
          initialSort={params.sort}
        />
      </Suspense>

      {/* Siduri Integration Banner */}
      <section className="catalog-install-banner" aria-labelledby="install-banner-title">
        <div>
          <p className="eyebrow">From catalog to companion</p>
          <h2 id="install-banner-title">Install knowledge where it belongs.</h2>
          <p>
            Siduri owns local installation and runtime state. The Hub makes packs discoverable,
            cited, and distributable.
          </p>
        </div>
        <div className="install-code">
          <span className="code-label">SIDURI CLI</span>
          <code>
            <b>$</b> siduri create
            <br />
            <em>Knowledge pack path?</em> ./knowledge-pack
          </code>
          <span className="code-caption">
            Or configure an E remote provider endpoint in your companion config.
          </span>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <span>© 2026 E Knowledge Hub</span>
        <span>
          Protocol by{" "}
          <a href="https://github.com/vxnus-studio/e" target="_blank" rel="noreferrer">
            @vxnus/e
          </a>
        </span>
      </footer>
    </main>
  );
}
