# `@vxnus/e-sqlite`

[![npm](https://img.shields.io/npm/v/@vxnus/e-sqlite)](https://www.npmjs.com/package/@vxnus/e-sqlite)

SQLite storage adapter and schema for the **E** knowledge graph runtime.

> **Note:** E is currently pre-1.0 (`0.1.0`) and experimental. Published by [@vxnus](https://www.npmjs.com/~vxnus).

## Installation

```bash
npm install @vxnus/e @vxnus/e-sqlite better-sqlite3
```

`@vxnus/e` and `better-sqlite3` are required as peer dependencies.

## Schema Provisioning

`SqliteEngine` automatically provisions the necessary tables and indexes upon instantiation if they do not already exist. 

Alternatively, the canonical SQL schema is distributed as `@vxnus/e-sqlite/schema.sql` if you prefer to inspect or run it manually:

```bash
sqlite3 database.db < node_modules/@vxnus/e-sqlite/schema.sql
```

## Usage

```typescript
import { SqliteEngine } from "@vxnus/e-sqlite";
import type { QueryRequest, KnowledgeResult } from "@vxnus/e";

// Initialize SQLite engine with a database file path or ":memory:"
const engine = new SqliteEngine("knowledge.db");

// Perform graph traversal
const result: KnowledgeResult = await engine.query({
  type: "traverse",
  startId: "node_123",
  maxDepth: 3,
  predicates: ["depends_on", "relates_to"]
});

// Close database when finished
engine.close();
```

## Capabilities

`SqliteEngine` implements:
- `exactResolution` (alias lookups)
- `lexicalSearch` (LIKE matching across entity names and slugs)
- `relations` (bidirectional relationship querying with entity hydration)
- `traversal` (bounded BFS graph traversal with cycle protection)
- `claims` & `documents` querying
- `provenance` metadata mapping

## License

Licensed under the [E Architecture Non-Commercial License](LICENSE).
