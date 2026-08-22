# E Architecture Specification

## What E Is

E is a domain-agnostic knowledge runtime and query layer. It serves as a unified abstraction over storage, exposing a structured graph of entities, claims, and relations that AI systems (like Siduri) can query.

E is NOT:
- A wiki or CMS
- A specific database implementation (it can use Postgres, SQLite, or in-memory)
- An HTTP API or MCP server (these are transport layers)
- A collection of hardcoded domain presets

## Core Principle: Domain is Data, not Architecture

The architecture enforces a strict boundary between the generic E runtime and any domain-specific ontology. E Core does not know what a "Character" or "API" is. It only knows about `Entity`, `Relation`, and `Claim`. Domain logic is injected purely as data.

## Identity and Namespaces

- **Entities** have unique IDs (usually UUIDs or ULIDs for persistence, though the in-memory engine can use strings). They can also map to external systems via an `identities` array.
- **Namespaces** group entities by domain (e.g., `teyvat`, `schale`, `software`). This ensures that `Entity(name: "API", namespace: "software")` does not collide with anything else.
- **Aliases** are separate records pointing to an Entity, allowing robust resolution of alternative names without mutating the core Entity record.
- **Provenance & Temporal Semantics** attach source truthfulness (`confidence`, `source`) and time boundaries (`validFrom`, `validUntil`) to Entities, Relations, and Claims, ensuring AI can reason about *when* and *where* facts come from.

## Canonical Abstraction

The system exposes a single Query engine:

```typescript
engine.query(request) -> Promise<KnowledgeResult>
```

This enforces the boundary where AI consumers (like Siduri) do not need to reverse-engineer graph structures or database schemas; they receive hydrated, ready-to-use context.

## Storage Boundary

E defines the models and the query interfaces. The actual persistence and retrieval mechanics are left to adapters. Core currently provides an in-memory reference engine, while distinct workspace packages (`@vxnus/e-postgres`, `@vxnus/e-sqlite`) provide robust database implementations.

## Write / Ingestion Boundary

E Core and the `EQueryEngine` interface are intentionally retrieval-oriented. E does not provide generic "write" or "upsert" APIs.

The intended architecture is:
```text
  External Ingestion Pipeline
                 ↓
      E Storage (Postgres / SQLite schemas)
                 ↓
      EQueryEngine (Read-only Graph Traversal)
                 ↓
      Consumers (Siduri / AI Agents)
```
Ingestion pipelines are responsible for connecting to the underlying database natively (e.g., via standard SQL) and inserting `Entities`, `Relations`, `Claims`, and `Documents` that conform to the E schemas. This keeps E Core light, robust, and strictly focused on serving contextual knowledge safely.
