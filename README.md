# E

[![npm (core)](https://img.shields.io/npm/v/@vxnus/e?label=%40vxnus%2Fe)](https://www.npmjs.com/package/@vxnus/e)
[![npm (postgres)](https://img.shields.io/npm/v/@vxnus/e-postgres?label=%40vxnus%2Fe-postgres)](https://www.npmjs.com/package/@vxnus/e-postgres)
[![npm (sqlite)](https://img.shields.io/npm/v/@vxnus/e-sqlite?label=%40vxnus%2Fe-sqlite)](https://www.npmjs.com/package/@vxnus/e-sqlite)
[![npm profile](https://img.shields.io/badge/npm-~vxnus-CB3837?logo=npm)](https://www.npmjs.com/~vxnus)

E is a **domain-agnostic knowledge runtime and graph query layer**.
 
> **Version 0.1.0 (Early / Experimental)**  
> E is pre-1.0 and under active development. APIs and schema conventions may evolve.

It provides a unified schema, query contract, and retrieval engine so that AI systems can retrieve structured, evidence-backed knowledge across different domains (e.g., fictional universes, software architecture, internal wikis) without needing to guess via unstructured RAG or reverse-engineer SQL.

## Repository Structure & Packages

All published packages are available on npm under [@vxnus](https://www.npmjs.com/~vxnus):

- [`packages/core`](packages/core) ([`@vxnus/e`](https://www.npmjs.com/package/@vxnus/e)): The foundational TypeScript types, query contracts, error definitions, and lightweight `InMemoryEngine`.
- [`packages/postgres`](packages/postgres) ([`@vxnus/e-postgres`](https://www.npmjs.com/package/@vxnus/e-postgres)): PostgreSQL / Neon persistence adapter and canonical SQL schema.
- [`packages/sqlite`](packages/sqlite) ([`@vxnus/e-sqlite`](https://www.npmjs.com/package/@vxnus/e-sqlite)): SQLite persistence adapter using `better-sqlite3`.

## Architecture & Semantics

E operates as a unified contract bridging underlying databases and knowledge consumers:
- **Entities, Aliases, Relations, Claims, Documents:** Standardized graph and evidence models with provenance and temporal metadata.
- **Cycle-Protected BFS Traversal:** Deterministic, bounded multi-hop graph retrieval with depth, path limits, and direction filters.
- **Engine Parity:** Standardized query execution across in-memory, SQLite, and PostgreSQL backends.

## Installation

```bash
# Core contract and in-memory engine
npm install @vxnus/e

# PostgreSQL adapter
npm install @vxnus/e @vxnus/e-postgres pg

# SQLite adapter
npm install @vxnus/e @vxnus/e-sqlite better-sqlite3
```

## Quick Start

```typescript
import { InMemoryEngine } from "@vxnus/e";

const engine = new InMemoryEngine();
engine.insertEntity({
  id: "character_lumine",
  namespace: "teyvat",
  kind: "traveler",
  slug: "lumine",
  name: "Lumine",
  data: { element: "Anemo" }
});

const result = await engine.query({
  type: "getEntity",
  id: "character_lumine"
});

console.log(result.entities);
```

## Building & Testing

### Build All Packages
```bash
npm run build
```

### Run Tests
```bash
npm test
```

To run PostgreSQL adapter tests locally, provide a `TEST_DATABASE_URL`:
```bash
TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5432/postgres" npm test
```

## License

E is licensed under the [E Architecture Non-Commercial License](LICENSE).

