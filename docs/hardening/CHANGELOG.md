# Hardening Changelog

All notable hardening changes across the E runtime are recorded in this document.

---

## [Phase 3] - Persistence Correctness
- **Resolved [P0] SQL Metadata Persistence Loss**:
  - Updated `SqliteEngine` (`packages/sqlite/src/index.ts`) `insertEntity`, `insertRelation`, `insertClaim`, and `insertDocument` to serialize and persist `identities`, `provenance`, `temporal`, and relation `metadata` to SQLite columns.
  - Updated `PostgresEngine` (`packages/postgres/src/index.ts`) to persist `identities`, `provenance`, `temporal`, and relation `metadata` into native PostgreSQL JSONB columns.
- **Resolved [P0] InMemory Object Reference Leakage**:
  - Implemented `cloneValue()` deep cloning (`structuredClone` with fallback) in `InMemoryEngine` (`packages/core/src/engine.ts`).
  - Isolated caller-owned input objects upon mutation (`insert*`).
  - Isolated returned query objects from `InMemoryEngine.query()`.
- **Created Comprehensive Field Round-Trip Test Suite**:
  - Expanded `packages/differential/test/persistence_roundtrip.test.ts` to assert 100% round-trip preservation of primary fields, metadata, provenance, temporal mappings, and complex JSON data structures (nulls, booleans, arrays, nested objects) across InMemory, SQLite, and PostgreSQL.
  - Added strict isolation tests verifying that mutating inputs or query returns does not alter internal engine state.
- **Created PERSISTENCE.md**: Full field-level persistence matrix documenting columns, serialization, and round-trip status.

---

## [Phase 2] - Core Contract + Error Semantics
- Established canonical error taxonomy in [ERRORS.md](./ERRORS.md).
- Harmonized traversal parameter validation order across all three engines.
- Standardized `QueryError` on non-object query/search inputs and `UnsupportedOperationError` on unknown query types.

---

## [Phase 1] - Test Infrastructure and Contract Truth
- Repaired differential test harness PostgreSQL fixture mutation delegation bug.
- Added harness invariant isolation test.
- Replaced console logs with strict assertions across search audit suites.
- Created differential test suites.

---

## [Phase 0] - Baseline Forensic Audit
- Completed baseline audit of core types, engines, adapters, schemas, and test suites.
- Documented findings in [AUDIT.md](./AUDIT.md) and established [ROADMAP.md](./ROADMAP.md).
