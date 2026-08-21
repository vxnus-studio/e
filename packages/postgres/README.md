# @e/postgres

PostgreSQL adapter for E Core.

## Installation

```bash
npm install @e/postgres pg
```

## Schema Provisioning

This adapter requires the core E schema to exist in your PostgreSQL database.
The canonical generic schema is provided in `schema.sql` at the root of this package.

To provision your database, simply execute the `schema.sql` file against your target PostgreSQL database (Local, Neon, Supabase, etc).

```bash
psql -d my_database -f node_modules/@e/postgres/schema.sql
```

The adapter itself performs no implicit migrations or schema syncing on startup. It strictly relies on the schema being present.
