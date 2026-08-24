# E

> **Architectural decision (August 2026): E is changing direction.**
>
> E is no longer intended to be a generic database runtime or a universal
> PostgreSQL/SQLite engine. Its durable purpose is to define the portable
> knowledge contract that lets Siduri install and consume knowledge bases from
> a common hub.
>
> A knowledge publisher should be able to publish an E-compatible knowledge
> pack once—whether it describes a game, company, wiki, codebase, or corpus—so
> that a Siduri instance can install it locally or connect to it remotely
> without requiring a custom Siduri integration.
>
> The target model is:
>
> ```text
> knowledge publisher -> E-compatible knowledge pack -> Siduri Knowledge Hub
> ```
>
> The contract should standardize pack identity, versioning, sources,
> documents/chunks, provenance, revisions, retrieval, and optional structured
> entities/relations. It should not prescribe a database driver, connection
> pool, generic traversal engine, web framework, or domain-specific semantics.
> Those belong to Siduri or to the knowledge pack implementation.


[![npm (core)](https://img.shields.io/npm/v/@vxnus/e?label=%40vxnus%2Fe)](https://www.npmjs.com/package/@vxnus/e)
[![npm (postgres)](https://img.shields.io/npm/v/@vxnus/e-postgres?label=%40vxnus%2Fe-postgres)](https://www.npmjs.com/package/@vxnus/e-postgres)
[![npm (sqlite)](https://img.shields.io/npm/v/@vxnus/e-sqlite?label=%40vxnus%2Fe-sqlite)](https://www.npmjs.com/package/@vxnus/e-sqlite)
[![npm profile](https://img.shields.io/badge/npm-~vxnus-CB3837?logo=npm)](https://www.npmjs.com/~vxnus)

E is a **domain-agnostic knowledge-pack contract for Siduri**.
 
> **Version 0.2.0 (Early / Experimental)**
> E is pre-1.0 and under active development. APIs and schema conventions may evolve.

It provides a portable schema and retrieval contract so knowledge publishers can
ship installable, evidence-backed knowledge across different domains (fictional
universes, software architecture, internal wikis, and general corpora). Siduri
can discover, install, update, scope, and retrieve these packs through its
Knowledge Hub without requiring a custom integration for every knowledge base.

The important boundary is the pack and consumer contract—not a mandated
storage implementation. A pack may be backed by PostgreSQL, SQLite, files,
vectors, an API, or another system, as long as it exposes the E contract.

## Repository Structure & Packages

All published packages are available on npm under [@vxnus](https://www.npmjs.com/~vxnus):

- [`packages/core`](packages/core) ([`@vxnus/e`](https://www.npmjs.com/package/@vxnus/e)): Foundational types, validation, and the evolving pack/retrieval contract.
- [`packages/postgres`](packages/postgres) ([`@vxnus/e-postgres`](https://www.npmjs.com/package/@vxnus/e-postgres)): **Experimental/legacy** generic PostgreSQL adapter. It is not required by Siduri or by an E-compatible pack.
- [`packages/sqlite`](packages/sqlite) ([`@vxnus/e-sqlite`](https://www.npmjs.com/package/@vxnus/e-sqlite)): **Experimental/legacy** SQLite adapter.

## Architecture & Semantics

E operates as a portable boundary between knowledge publishers and Siduri:
- **Pack identity and lifecycle:** Stable IDs, versions, schema compatibility, installation, and revisions.
- **Evidence-backed content:** Sources, documents/chunks, provenance, citations, and optional embeddings.
- **Optional structure:** Entities, aliases, and relations for packs that need graph-aware retrieval.
- **Retrieval:** A common way for Siduri to request relevant context and receive grounded results.

Domain behavior remains with the pack. For example, farming logic belongs to
E-Teyvat, while companion memory and orchestration belong to Siduri.

## Current package status

The published database engines predate this decision and remain useful as
reference implementations while the pack format is defined. They should not be
treated as the required architecture for new Siduri integrations. The next
version of E should prioritize a stable pack manifest, portable schema,
installation format, and retrieval contract.

See [the pivot decision](docs/PIVOT.md) for the current architecture and the
boundary between E, Siduri, and knowledge publishers.

## Historical engine installation

```bash
# Core contract and in-memory engine
npm install @vxnus/e

# PostgreSQL adapter
npm install @vxnus/e @vxnus/e-postgres pg

# SQLite adapter
npm install @vxnus/e @vxnus/e-sqlite better-sqlite3
```

## Historical engine quick start

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
