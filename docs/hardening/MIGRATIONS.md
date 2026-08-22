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
- **Idempotency**: DDL statements use `IF NOT EXISTS` guards, allowing safe re-application against existing databases.
