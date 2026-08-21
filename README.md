# E

E is a **domain-agnostic knowledge runtime and graph query layer**.

It provides a unified schema, query contract, and retrieval engine so that AI systems can retrieve structured, evidence-backed knowledge across different domains (e.g., fictional universes, software architecture, internal wikis) without needing to guess via unstructured RAG or reverse-engineer SQL.

## Repository Structure

This repository is a monorepo containing the following packages:

- `packages/core`: The core TypeScript types, query contracts, and an `InMemoryEngine`. This package defines the foundational generic contract for `E`.
- `packages/postgres`: The production PostgreSQL adapter and schema definition.
- `packages/sqlite`: The production SQLite adapter.

## Architecture & Semantics

E operates as a unified contract bridging underlying databases and knowledge consumers. All storage backend implementations in this repository guarantee exactly identical query semantics (including graph traversals, searches, provenance mapping, and temporal capability).

For more detailed technical documentation on the E architecture, query interfaces, and traversal semantics, please see the [Core Documentation](packages/core/README.md) and the `packages/core/docs/` directory.

## Getting Started

Install the dependencies:

```bash
npm install
```

### Building

```bash
npm run build
```

### Testing

The test suite validates the generic query contract across all backend environments. 

To run the complete suite, including database parity checks, ensure a PostgreSQL test database is running and execute:

```bash
TEST_DATABASE_URL="postgres://postgres@localhost/e_test" npm test
```

## License

E is licensed under the [E Architecture Non-Commercial License](LICENSE).
