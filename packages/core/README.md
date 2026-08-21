# E Core

E is a **domain-agnostic knowledge runtime and graph query layer**.

It provides a unified schema, query contract, and retrieval engine so that AI systems can retrieve structured, evidence-backed knowledge across different domains (e.g., fictional universes, software architecture, internal wikis) without needing to guess via unstructured RAG or reverse-engineer SQL.

## Architecture

E acts as a layer over persistence. It standardizes the shape of data into a graph, avoiding domain-specific hardcodes in the core query engine.

### Current Core Capabilities
The E schema natively supports:
- **Entities:** Nodes in the graph with a `kind`, domain-specific `data`, and mapped external `identities`.
- **Aliases:** Alternative names for entities to aid in resolution.
- **Relations:** Directed edges between entities with an optional predicate.
- **Claims:** Source-backed statements about an entity.
- **Documents:** Long-form text attached to an entity for semantic search.
- **Provenance & Temporal Semantics:** Universal properties across schema components for tracking data sources, revisions, and temporal validity.

### Graph Traversal
E features a scalable, cycle-protected, Breadth-First Search (BFS) graph traversal engine. Starting from a root entity, it can predictably fetch deep relational context without N+1 query scaling issues, supporting bounded depth limits, bidirectional edge traversal, multiple traversal paths, and predicate filtering.

### Current Limitations
- **Read-Only API:** E's query contract is strictly retrieval-oriented. Write/Ingestion APIs must be handled directly via the underlying database using the E schemas.
- **Local Bounding:** Graph traversals operate locally within the configured database engine; distributed or federated cross-database traversal is not supported.
- **Alias Scoping:** Aliases currently resolve flatly per-namespace. Language-based scoping is a future proposal.

## Packages

E is distributed as a monorepo with multiple packages:

- `e`: The core TypeScript types, query contracts, and an `InMemoryEngine`.
- `@e/sqlite`: The production SQLite adapter.
- `@e/postgres`: The production PostgreSQL adapter.

Since these are currently workspace packages, you can use them within this repository, or install them via npm if published:

```bash
# To install the core interface
npm install e
# To install a persistence backend
npm install @e/sqlite
```

## Basic Usage

The package exposes the core types and an `InMemoryEngine` for testing.

```typescript
import { InMemoryEngine } from "e";
import type { QueryRequest } from "e";

const engine = new InMemoryEngine();

// Traverse the graph starting from an entity
const result = await engine.query({ 
  type: "traverse", 
  startId: "char_1",
  maxDepth: 2,
  predicates: ["knows"]
});
```

See the `docs/` folder for architectural guidelines, such as `QUERY.md` and `HYDRATION_AND_ERRORS.md`, which formalize the engine guarantees.

## Future/Proposed Capabilities
- Advanced `Claim` evidence chaining.
- Vector-based semantic search integration at the engine level.
- Multi-language scoped aliases.



## Development and Testing

The repository uses `vitest` for the behavioral and backend parity test suite. 

### Local Testing
To test the core in-memory logic:
```bash
npm test -w e
```

To run the full workspace test suite (which validates parity across all backend engines):
```bash
TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres npm test
```

### Backend Requirements
- **PostgreSQL:** The Postgres parity tests require a running database instance. Set `TEST_DATABASE_URL` to point to a temporary test database (it will drop and recreate tables automatically during setup). If this variable is omitted locally, the Postgres tests will be cleanly skipped.
- **SQLite:** The SQLite tests require `better-sqlite3` native bindings to be compiled. If your local Node runtime is incompatible with the pinned version (e.g., Node v26.7.0 `node-gyp` V8 API changes), the SQLite tests will gracefully skip locally. 

### CI Behavior
In a Continuous Integration environment (where `process.env.CI` is true):
- Backend tests are **strictly required**. 
- If `TEST_DATABASE_URL` is missing, or if `better-sqlite3` native bindings fail to load, the test suite will intentionally throw a loud `Error` and fail the build to prevent silent test rotting. Backends are only optional in local development.
