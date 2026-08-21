# E-Teyvat Architecture Investigation

> **STATUS: HISTORICAL**
> *Note: This document contains the initial investigation of migrating e-teyvat to E Core. It reflects the state of the codebase at that specific time and is retained for historical context.*

## Executive Summary
This document analyzes the current `e-teyvat` repository to determine how it can eventually implement the `E Core` contract without contaminating the pure `E` architecture. E-Teyvat currently operates as a monolith (Next.js + Drizzle + Neon) containing both generic knowledge tables and Teyvat-specific logic.

## 1. Mapping E-Teyvat to E Core

| E Core Concept | E-Teyvat Concept | Relationship | Notes |
|---|---|---|---|
| Entity | `entities` table | Direct | E-Teyvat uses `id` (serial integer), `slug`, `kind`, and `canonicalData` (JSONB). |
| Alias | `aliases` table | Direct | E-Teyvat maintains `normalizedAlias` and `language` for resolution. |
| Relation | `relations` table | Direct | Fully supports subject, object, predicate, and metadata. |
| Claim | (None) | Missing | E-Teyvat assumes ingested data is absolute fact; it lacks a provenance/confidence model for subjective lore. |
| Document | `knowledge_documents` | Direct | Stores long-form text and pgvector embeddings. |
| QueryRequest | API route parameters | Partial | Current APIs map loosely to `search` (in `/api/entities`) and `getEntity` + `findRelations` (in `/api/entities/[kind]/[slug]`). |
| KnowledgeResult | `NextResponse.json` | Partial | Returns raw DB rows rather than a formal hydrated graph. |
| EQueryEngine | Route Handlers / SQL | Missing | Currently, SQL joins are hardcoded in Next.js routes. |

## 2. Generic vs. Teyvat-Specific Concepts

### Generic (Should implement E Core types/contracts):
- Entities, Aliases, Relations, Knowledge Documents
- Sync Runs (as a generic concept of ingestion history)
- Full-text search and vector retrieval semantics

### Teyvat-Specific (Must remain in E-Teyvat):
- `banner_sources`, `banner_phases`, `banner_phase_characters`, `banner_character_statistics`
- Genshin-specific scripts (`sync-genshin.ts`, `sync-banners.ts`)
- Specific logic inside route handlers that parses Teyvat-specific stats (e.g. `rarity` or `element` mapping).

## 3. Query Compatibility Matrix

| E Query Intent | Existing Capability in E-Teyvat | Adapter Effort | Contract Issue |
|---|---|---|---|
| `resolve` | Implicit via `aliases` table during ingestion | Low | None. Just requires an SQL query against `aliases` joined with `entities`. |
| `getEntity` | `/api/entities/[kind]/[slug]` | Low | Needs to fetch by unique ID rather than just kind/slug, or map ID formats. |
| `findRelations`| Built into the entity detail API route | Low | Already performs joins and returns metadata. |
| `findClaims` | None | High | E-Teyvat schema must be updated to support the `Claim` concept if it wants to expose lore as claims. |
| `search` | `/api/entities?q=...` & `/api/knowledge/search` | Medium | Needs to be unified into the `EQueryEngine` search intent. |
| `traverse` | None (max depth 1 in detail route) | High | Would require recursive CTEs in Postgres or multiple queries. |

## 4. Entity Identity

**Current E-Teyvat Identity:**
- Database Primary Key: `id` (serial integer).
- Ingestion Key: `sourceKey` (e.g., from Genshin-DB).
- Human-readable ID: `kind` + `slug` (e.g., `character` + `zhongli`).

**Mapping to E Core:**
E Core defines `Entity.id` as a string. To adapt E-Teyvat to E Core:
- The adapter should map the Postgres `id` (or a combination of `namespace:kind:slug`) to the E Core `Entity.id`. 
- The namespace string in E Core should be hardcoded to `"teyvat"` by the adapter.
- The `alias` system remains the primary way for AI (like Siduri) to resolve varying names to the canonical ID.

## 5. Domain Extensions (How Teyvat specific concepts fit in)

Teyvat-specific logic will NOT touch E Core. Instead, E-Teyvat will build its specific tables (`banner_phases`, etc.) as external tables that carry foreign keys referencing the `entities` table's IDs. 

When returning data through `EQueryEngine`:
- The core data maps to `Entity`, `Relation`, etc.
- The Teyvat-specific attributes (e.g., weapon type, rarity, element) are injected into the `Entity.data` Record (JSONB column `canonicalData`).
- If an AI needs advanced banner predictions, E-Teyvat can expose a separate API route (e.g., `/api/banners`) entirely outside the E Core contract, or inject it as structured `Document` context attached to character entities.
