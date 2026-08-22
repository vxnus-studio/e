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
- **PostgreSQL replay**: Migration `001` uses `IF NOT EXISTS` guards and is replay-safe at the SQL statement level.
- **SQLite replay**: The runtime runner is replay-safe because recorded versions are skipped and the schema is checked for compatibility. The SQL file under `packages/sqlite/migrations` remains a historical/manual artifact; production upgrades should open the database through `SqliteEngine`, not execute that file directly.
- **Failure semantics**: A failed SQLite migration rolls back its DDL and history insert, then raises `StorageError(code=SCHEMA_MIGRATION_FAILED)`. A later open retries the unapplied version. A recorded version with missing columns fails closed as `SCHEMA_INCOMPATIBLE` rather than guessing.
- **PostgreSQL status**: PostgreSQL version tracking, transactional runner, and advisory-lock coordination remain a separate hardening batch; the current SQL migration is not yet the authoritative runtime lifecycle.
