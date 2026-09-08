import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { registry } from "@/lib/registry";
import { CatalogRefresh } from "@/app/catalog-refresh";
import { CatalogBrowser } from "./catalog-browser";
import "./catalog.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Knowledge Catalog · E Hub",
  description:
    "Browse versioned, cited knowledge capabilities ready to install into E-compatible AI or query via remote provider.",
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
          <span className="brand-mark">E</span> Hub
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
          <p className="eyebrow">E Hub Capabilities · Knowledge</p>
          <h1 id="catalog-hero-title">Knowledge your AI can trust.</h1>
          <p className="catalog-hero-lede">
            Discover versioned, cited knowledge packs built for E-compatible AI. Filter by
            distribution format, provenance verification, and capabilities.
          </p>
        </div>

        <div className="catalog-hero-stats" aria-label="Catalog status">
          <div className="catalog-stat-item">
            <span>Indexed packs</span>
            <strong>{packs.length}</strong>
            <small>Knowledge capability</small>
          </div>
          <div className="catalog-stat-item">
            <span>Format</span>
            <strong>Local + API</strong>
            <small>E-compatible</small>
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

      {/* Footer */}
      <footer>
        <span>© 2026 E Hub</span>
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
