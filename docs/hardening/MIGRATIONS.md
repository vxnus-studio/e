# E Database Migration & Fresh Install Guide

This document defines the database initialization lifecycle and migration replay procedures.

---

## 1. Fresh Install Procedure

### PostgreSQL:
Execute `packages/postgres/schema.sql` against the target database:
```bash
psql $DATABASE_URL -f packages/postgres/schema.sql
```

### SQLite:
SQLite adapter automatically initializes `packages/sqlite/schema.sql` on database connection instantiation if tables do not exist.

---

## 2. Migration Replay & Versioning

- **Migration Files**:
  - `001_add_provenance_and_identities.sql` adds JSONB/TEXT columns (`identities`, `provenance`, `temporal`, `metadata`) for legacy databases instantiated prior to Phase 3.
- **SQLite version tracking**: `SqliteEngine` maintains `e_schema_migrations` with a unique integer version, migration name, and completion timestamp. Opening a current database records version `1`; opening a legacy database applies the missing metadata columns and records it. Migration application uses `BEGIN IMMEDIATE`, so concurrent writers cannot interleave the upgrade.
- **PostgreSQL version tracking**: `PostgresEngine.open(config)` runs the authoritative lifecycle. It creates the current base tables, upgrades legacy metadata columns, records version `1` in `e_schema_migrations`, and skips a recorded version on replay. `PostgresEngine.migrate()` is also available when the caller owns engine construction.
- **PostgreSQL concurrency**: Migration attempts take `pg_advisory_xact_lock(hashtext('e-schema-migrations'))` inside the migration transaction, so concurrent processes serialize without holding a session-level lock.
- **SQLite replay**: The runtime runner is replay-safe because recorded versions are skipped and the schema is checked for compatibility. The SQL file under `packages/sqlite/migrations` remains a historical/manual artifact; production upgrades should open the database through `SqliteEngine`, not execute that file directly.
- **Failure semantics**: A failed SQLite migration rolls back its DDL and history insert, then raises `StorageError(code=SCHEMA_MIGRATION_FAILED)`. A later open retries the unapplied version. A recorded version with missing columns fails closed as `SCHEMA_INCOMPATIBLE` rather than guessing.
- **PostgreSQL failure semantics**: DDL, history insertion, and indexes commit together. A failure rolls back and raises `StorageError(code=SCHEMA_MIGRATION_FAILED)`; rollback failure is reported as `TRANSACTION_ROLLBACK_FAILED`. A later invocation retries an unapplied version. Unknown future versions and mismatched history fail closed.
