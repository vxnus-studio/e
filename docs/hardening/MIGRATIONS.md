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
- **Version tracking**: There is currently no migration-history table or runtime migration runner. Migration files are manually applied by operators/tests and are not sufficient evidence of an upgrade lifecycle by themselves.
- **PostgreSQL replay**: Migration `001` uses `IF NOT EXISTS` guards and is replay-safe at the SQL statement level.
- **SQLite replay**: Migration `001` uses bare `ALTER TABLE ... ADD COLUMN` statements and is not replay-safe; applying it twice fails with duplicate-column errors. Do not reapply it without an external schema inspection/guard.
- **Production blocker**: A versioned migration runner, transactional upgrade policy, failure/retry semantics, and concurrent migration policy remain unimplemented.
