# @e/sqlite

SQLite adapter for E Core.

## Installation

```bash
npm install @e/sqlite better-sqlite3
```

## Schema Provisioning

This adapter requires the core E schema to exist in your SQLite database.
The canonical generic schema is provided in `schema.sql` at the root of this package.

To provision your database, simply execute the `schema.sql` file against your target SQLite database file.

```bash
sqlite3 my_database.db < node_modules/@e/sqlite/schema.sql
```

The adapter itself performs no implicit migrations or schema syncing on startup. It strictly relies on the schema being present.

## Usage

```typescript
import Database from "better-sqlite3";
import { SqliteEngine } from "@e/sqlite";

const db = new Database("my_database.db");
const engine = new SqliteEngine(db);

const result = await engine.query({
  type: "traverse",
  startId: "some_id"
});
```
