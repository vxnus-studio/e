# `@vxnus/e-postgres`

[![npm](https://img.shields.io/npm/v/@vxnus/e-postgres)](https://www.npmjs.com/package/@vxnus/e-postgres)

PostgreSQL / Neon storage adapter and schema for the **E** knowledge graph runtime.

> **Note:** E is currently pre-1.0 (`0.1.0`) and experimental. Published by [@vxnus](https://www.npmjs.com/~vxnus).

## Installation

```bash
npm install @vxnus/e @vxnus/e-postgres pg
```

`@vxnus/e` is required as a peer dependency.

## Schema Provisioning

The adapter exposes an authoritative PostgreSQL schema lifecycle. Use `PostgresEngine.open(config)` for a fresh install or upgrade; it runs migrations transactionally under a PostgreSQL advisory lock and records applied versions in `e_schema_migrations`. `new PostgresEngine(config)` remains available when schema lifecycle ownership is external, but queries and mutations require a compatible schema.

The canonical schema is also packaged directly with `@vxnus/e-postgres` as `schema.sql` for inspection and controlled provisioning.

### Applying the Schema

You can apply the SQL schema directly from the installed package:

```bash
# Using psql CLI
psql -d "$DATABASE_URL" -f node_modules/@vxnus/e-postgres/schema.sql
```

Or via Node.js:

```typescript
import * as fs from "fs";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const schemaSql = fs.readFileSync(
  require.resolve("@vxnus/e-postgres/schema.sql"),
  "utf-8"
);
await pool.query(schemaSql);
```

## Usage

```typescript
import { PostgresEngine } from "@vxnus/e-postgres";
import type { QueryRequest, KnowledgeResult } from "@vxnus/e";

// Initialize with pg PoolConfig
const engine = new PostgresEngine({
  connectionString: process.env.DATABASE_URL
});

// Perform graph traversal
const result: KnowledgeResult = await engine.query({
  type: "traverse",
  startId: "node_123",
  maxDepth: 3,
  predicates: ["depends_on", "relates_to"]
});

// Close connections when done
await engine.close();
```

## Capabilities

`PostgresEngine` implements:
- `exactResolution` (alias lookups)
- `lexicalSearch` (ILIKE matching across entity names and slugs)
- `relations` (bidirectional relationship querying with entity hydration)
- `traversal` (bounded BFS graph traversal with cycle protection)
- `claims` & `documents` querying
- `provenance` metadata mapping

## License

Licensed under the [E Architecture Non-Commercial License](LICENSE).
