"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { RegistryPack } from "@vxnus/e-registry";

interface CatalogBrowserProps {
  initialPacks: RegistryPack[];
  initialQuery?: string;
  initialType?: string;
  initialVerified?: boolean;
  initialCapability?: string;
  initialSort?: string;
}

const CAPABILITY_LABELS: Record<string, string> = {
  lexicalSearch: "Lexical Search",
  semanticSearch: "Semantic Search",
  structuredEntities: "Structured Entities",
  relations: "Knowledge Graph / Relations",
};

export function CatalogBrowser({
  initialPacks,
  initialQuery = "",
  initialType = "all",
  initialVerified = false,
  initialCapability = "all",
  initialSort = "name-asc",
}: CatalogBrowserProps) {
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(initialQuery || searchParams.get("q") || "");
  const [distType, setDistType] = useState(initialType || searchParams.get("type") || "all");
  const [verifiedOnly, setVerifiedOnly] = useState(
    initialVerified || searchParams.get("verified") === "true"
  );
  const [capability, setCapability] = useState(
    initialCapability || searchParams.get("cap") || "all"
  );
  const [sortBy, setSortBy] = useState(initialSort || searchParams.get("sort") || "name-asc");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync state into URL search params for bookmarking and shareable links
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (distType !== "all") params.set("type", distType);
    if (verifiedOnly) params.set("verified", "true");
    if (capability !== "all") params.set("cap", capability);
    if (sortBy !== "name-asc") params.set("sort", sortBy);

    const newUrl = params.toString() ? `/catalog?${params.toString()}` : "/catalog";
    window.history.replaceState(null, "", newUrl);
  }, [query, distType, verifiedOnly, capability, sortBy]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback if clipboard API fails
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const hasActiveFilters =
    query.trim() !== "" || distType !== "all" || verifiedOnly || capability !== "all";

  const resetFilters = () => {
    setQuery("");
    setDistType("all");
    setVerifiedOnly(false);
    setCapability("all");
    setSortBy("name-asc");
  };

  const filteredPacks = useMemo(() => {
    const q = query.trim().toLowerCase();

    return initialPacks
      .filter((pack) => {
        // Query search
        if (q) {
          const idMatch = pack.id.toLowerCase().includes(q);
          const nameMatch = pack.name.toLowerCase().includes(q);
          const publisherMatch = pack.publisher.toLowerCase().includes(q);
          const descMatch = pack.description?.toLowerCase().includes(q);
          const sourceMatch = pack.sources?.some(
            (s) => s.title.toLowerCase().includes(q) || s.license.toLowerCase().includes(q)
          );
          if (!idMatch && !nameMatch && !publisherMatch && !descMatch && !sourceMatch) {
            return false;
          }
        }

        // Distribution type filter
        if (distType === "local") {
          if (pack.distributionType !== "local" && pack.distributionType !== "both") return false;
        } else if (distType === "remote") {
          if (pack.distributionType !== "remote" && pack.distributionType !== "both") return false;
        } else if (distType === "both") {
          if (pack.distributionType !== "both") return false;
        }

        // Verification filter
        if (verifiedOnly && !pack.verified) {
          return false;
        }

        // Capability filter
        if (capability !== "all") {
          const capRecord = pack.capabilities as unknown as Record<string, boolean | undefined>;
          if (!capRecord?.[capability]) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "name-asc") {
          return a.id.localeCompare(b.id);
        }
        if (sortBy === "name-desc") {
          return b.id.localeCompare(a.id);
        }
        if (sortBy === "version-desc") {
          return b.version.localeCompare(a.version, undefined, { numeric: true });
        }
        return 0;
      });
  }, [initialPacks, query, distType, verifiedOnly, capability, sortBy]);

  return (
    <div className="catalog-content">
      {/* Search & Filter Controls */}
      <div className="catalog-controls">
        <div className="catalog-search-row">
          <div className="catalog-search-wrap">
            <span className="catalog-search-icon" aria-hidden="true">
              ⌕
            </span>
            <input
              type="text"
              className="catalog-search-input"
              placeholder="Search knowledge packs by ID (@publisher/name), title, keywords, or license..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search knowledge packs"
            />
            {query && (
              <button
                type="button"
                className="catalog-search-clear"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="catalog-sort-wrap">
            <label htmlFor="catalog-sort" className="catalog-sort-label">
              Sort by
            </label>
            <select
              id="catalog-sort"
              className="catalog-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name-asc">Package ID (A → Z)</option>
              <option value="name-desc">Package ID (Z → A)</option>
              <option value="version-desc">Latest version</option>
            </select>
          </div>
        </div>

        {/* Primary Filter Pills */}
        <div className="catalog-filter-row">
          <div className="catalog-filter-group">
            <span className="catalog-filter-group-label">Distribution:</span>
            <button
              type="button"
              className={`filter-pill ${distType === "all" ? "active" : ""}`}
              onClick={() => setDistType("all")}
            >
              All Formats
            </button>
            <button
              type="button"
              className={`filter-pill ${distType === "local" ? "active" : ""}`}
              onClick={() => setDistType("local")}
            >
              Local Archive
            </button>
            <button
              type="button"
              className={`filter-pill ${distType === "remote" ? "active" : ""}`}
              onClick={() => setDistType("remote")}
            >
              Remote Provider
            </button>
            <button
              type="button"
              className={`filter-pill ${distType === "both" ? "active" : ""}`}
              onClick={() => setDistType("both")}
            >
              Hybrid
            </button>
          </div>

          <div className="catalog-filter-group">
            <span className="catalog-filter-group-label">Trust:</span>
            <button
              type="button"
              className={`filter-pill ${!verifiedOnly ? "active" : ""}`}
              onClick={() => setVerifiedOnly(false)}
            >
              All Statuses
            </button>
            <button
              type="button"
              className={`filter-pill ${verifiedOnly ? "active active-verified" : ""}`}
              onClick={() => setVerifiedOnly(!verifiedOnly)}
            >
              ✓ Verified only
            </button>
          </div>
        </div>

        {/* Capabilities Filters */}
        <div className="catalog-caps-row">
          <span className="catalog-filter-group-label">Capabilities:</span>
          <button
            type="button"
            className={`cap-pill ${capability === "all" ? "active" : ""}`}
            onClick={() => setCapability("all")}
          >
            All Capabilities
          </button>
          {Object.entries(CAPABILITY_LABELS).map(([capKey, capLabel]) => (
            <button
              key={capKey}
              type="button"
              className={`cap-pill ${capability === capKey ? "active" : ""}`}
              onClick={() => setCapability(capability === capKey ? "all" : capKey)}
            >
              {capLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Results Header / Active Filters */}
      <div className="catalog-status-bar">
        <span className="catalog-count-text">
          Showing <strong>{filteredPacks.length}</strong> of{" "}
          <strong>{initialPacks.length}</strong> knowledge{" "}
          {initialPacks.length === 1 ? "pack" : "packs"}
          {hasActiveFilters ? " (filtered)" : ""}
        </span>

        {hasActiveFilters && (
          <div className="catalog-active-tags">
            {query.trim() && (
              <span className="active-tag">
                Query: &quot;{query}&quot;
                <button type="button" onClick={() => setQuery("")}>
                  ✕
                </button>
              </span>
            )}
            {distType !== "all" && (
              <span className="active-tag">
                Format: {distType}
                <button type="button" onClick={() => setDistType("all")}>
                  ✕
                </button>
              </span>
            )}
            {verifiedOnly && (
              <span className="active-tag">
                Verified only
                <button type="button" onClick={() => setVerifiedOnly(false)}>
                  ✕
                </button>
              </span>
            )}
            {capability !== "all" && (
              <span className="active-tag">
                Cap: {CAPABILITY_LABELS[capability] || capability}
                <button type="button" onClick={() => setCapability("all")}>
                  ✕
                </button>
              </span>
            )}
            <button type="button" className="catalog-reset-all-btn" onClick={resetFilters}>
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Pack List or Empty State */}
      {filteredPacks.length > 0 ? (
        <section className="catalog-grid" aria-label="Knowledge packs list">
          {filteredPacks.map((pack, index) => {
            const rawId = pack.id.startsWith("@") ? pack.id.slice(1) : pack.id;
            const [publisher, name] = rawId.includes("/")
              ? rawId.split("/")
              : [pack.publisher, pack.name];
            const packUrl = `/packs/${publisher}/${name}`;
            const capabilitiesList = Object.entries(pack.capabilities || {})
              .filter(([, enabled]) => enabled)
              .map(([cap]) => cap);
            const isCopied = copiedId === pack.id;

            return (
              <article className="catalog-item-card" key={`${pack.id}@${pack.version}`}>
                <div className="catalog-item-num">{String(index + 1).padStart(2, "0")}</div>

                <div className="catalog-item-content">
                  <div className="catalog-item-header">
                    <h3 className="catalog-item-id">
                      <Link href={packUrl}>{pack.id}</Link>
                    </h3>
                    {pack.name && pack.name !== pack.id && (
                      <span className="catalog-item-name">· {pack.name}</span>
                    )}
                    <span className={pack.verified ? "badge-verified" : "badge-unverified"}>
                      <i /> {pack.verified ? "verified" : "unverified"}
                    </span>
                    <span className="badge-dist">
                      {pack.distributionType === "both"
                        ? "local & remote"
                        : pack.distributionType === "remote"
                        ? "remote provider"
                        : "local archive"}
                    </span>
                    <span className="badge-version">v{pack.version}</span>
                  </div>

                  {pack.description && (
                    <p className="catalog-item-desc">{pack.description}</p>
                  )}

                  {capabilitiesList.length > 0 && (
                    <div className="catalog-item-caps">
                      {capabilitiesList.map((cap) => (
                        <span className="cap-tag" key={cap}>
                          {cap}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="catalog-item-meta">
                    <span>
                      Publisher: <strong>@{pack.publisher}</strong>
                    </span>
                    {pack.sources?.[0]?.title && (
                      <span>Source: {pack.sources[0].title}</span>
                    )}
                    {pack.sources?.[0]?.license && (
                      <span>License: {pack.sources[0].license}</span>
                    )}
                    {pack.retrieval?.embedding && (
                      <span>
                        Embedding: {pack.retrieval.embedding.provider}/
                        {pack.retrieval.embedding.model}
                      </span>
                    )}
                  </div>
                </div>

                <div className="catalog-item-action">
                  <Link
                    className="catalog-item-arrow"
                    href={packUrl}
                    aria-label={`View details for ${pack.id}`}
                  >
                    ↗
                  </Link>
                  <button
                    type="button"
                    className={`catalog-copy-btn ${isCopied ? "copied" : ""}`}
                    onClick={() => copyToClipboard(pack.id, pack.id)}
                    title="Copy pack identifier"
                  >
                    {isCopied ? "✓ Copied" : "Copy ID"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      ) : initialPacks.length > 0 ? (
        <div className="catalog-empty-state">
          <span className="catalog-empty-glyph" aria-hidden="true">
            ∅
          </span>
          <h3>No matching knowledge packs</h3>
          <p>
            None of the indexed packs match your active filters. Try adjusting your search keywords
            or removing some filters.
          </p>
          <div className="catalog-empty-actions">
            <button type="button" className="button button-dark" onClick={resetFilters}>
              Clear all filters
            </button>
          </div>
        </div>
      ) : (
        <div className="catalog-empty-state">
          <span className="catalog-empty-glyph" aria-hidden="true">
            +
          </span>
          <h3>No knowledge packs indexed yet</h3>
          <p>
            The registry is currently waiting for knowledge publishers. Be the first to publish a
            portable or remote pack into Siduri&apos;s open ecosystem.
          </p>
          <div className="catalog-empty-actions">
            <Link className="button button-primary" href="/publish">
              Publish a pack ↗
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
