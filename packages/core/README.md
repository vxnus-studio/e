# `@vxnus/e` (E Core)

[![npm](https://img.shields.io/npm/v/@vxnus/e)](https://www.npmjs.com/package/@vxnus/e)

`@vxnus/e` is the foundational TypeScript library defining the **generic knowledge graph runtime and query contract**.

> **Note:** E is currently pre-1.0 (`0.2.0`) and under active development. APIs and schema conventions may evolve. Published by [@vxnus](https://www.npmjs.com/~vxnus).

## Purpose

E standardizes the representation and retrieval of structured, evidence-backed knowledge graphs across diverse domains (fictional universes, documentation, enterprise knowledge) without requiring hardcoded schema assumptions or fragile unstructured search.

## Core Schema Concepts

The core data contract defines the following entities:

- **Entity:** Graph nodes identified by canonical `id`, `namespace`, `kind`, `slug`, `name`, custom `data`, optional external `identities`, `provenance`, and `temporal` semantics.
- **Alias:** Alternate lookup keys associated with entities within a namespace.
- **Relation:** Directed edges between entities with a `predicate`, optional `provenance`, `temporal`, and `metadata`.
- **Claim:** Factual assertions or statements about an entity with confidence levels (`canon`, `theory`, `outdated`, `unverified`) and source attribution.
- **Document:** Text representations attached to an entity.
- **Provenance & TemporalSemantics:** Universal metadata tracking origins, revisions, confidence, and time validity.

## Engine Interface

The core query interface is `EQueryEngine`, executing structured `QueryRequest` payloads:

- `getEntity`: Retrieve a single entity by ID.
- `resolve`: Resolve entities by alias.
- `findRelations`: Query edges by `subjectId`, `objectId`, and optional `predicate` (hydrates connected entities).
- `findClaims`: Fetch claims attached to an entity.
- `findDocuments`: Fetch documents attached to an entity.
- `traverse`: Perform bounded, cycle-protected Breadth-First Search (BFS) graph traversals with depth, path limits, and predicate/direction filters.
- `search`: Lexical search on entity names and slugs.
- `getCapabilities`: Inspect backend feature capabilities.

## Installation

```bash
npm install @vxnus/e
```

## Usage

```typescript
import { InMemoryEngine } from "@vxnus/e";
import type { QueryRequest, KnowledgeResult } from "@vxnus/e";

// Initialize the lightweight in-memory engine
const engine = new InMemoryEngine();

// Insert an entity
engine.insertEntity({
  id: "node_1",
  namespace: "default",
  kind: "concept",
  slug: "alpha",
  name: "Alpha Concept",
  data: { topic: "graph" }
});

// Query the engine
const result: KnowledgeResult = await engine.query({
  type: "getEntity",
  id: "node_1"
});

console.log(result.entities);
```

## Available Packages

- `@vxnus/e`: Core interfaces, error classes, types, and `InMemoryEngine`.
- `@vxnus/e-postgres`: PostgreSQL / Neon adapter.
- `@vxnus/e-sqlite`: SQLite adapter using `better-sqlite3`.

## License

E is licensed under the [E Architecture Non-Commercial License](LICENSE).
