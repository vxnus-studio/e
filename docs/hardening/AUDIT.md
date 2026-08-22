# Forensic Audit Matrix & Final Reconciliation (Phase 8)

## Executive Summary

This matrix contains historical findings and is reconciled against the current head below. AUD-10's original “no migration runner” status is superseded by the SQLite runner and PostgreSQL `PostgresEngine.open()`/`migrate()` lifecycle; live PostgreSQL execution and scale measurement remain verification blockers.

This forensic audit reconciles all historical findings across the entire E runtime codebase (`@vxnus/e`, `@vxnus/e-sqlite`, `@vxnus/e-postgres`, and `@vxnus/differential`).

---

## 1. Complete Forensic Reconciliation Matrix

| ID | Finding | Severity | Status | Evidence | Resolution & Hardening Summary |
|---|---|---|---|---|---|
| **AUD-01** | `differential.test.ts` Postgres insert fixture mutated SQLite engine. | **P0** | **RESOLVED (Phase 1)** | `differential.test.ts:81-87` | Fixed fixture delegation; added backend isolation assertion. |
| **AUD-02** | Metadata fields (`provenance`, `temporal`, `identities`, `metadata`) dropped on insert in SQLite & Postgres. | **P0** | **RESOLVED (Phase 3)** | `sqlite/src/index.ts:536`, `postgres/src/index.ts:448` | Bound and persisted all metadata columns into JSON/JSONB; round-trip suite verified. |
| **AUD-03** | `InMemoryEngine` stored mutable caller object references without cloning. | **P0** | **RESOLVED (Phase 3)** | `core/src/engine.ts:25-70` | Implemented deep cloning via `structuredClone` on insert and query return. |
| **AUD-04** | Inconsistent error classes and validation ordering across engines on malformed queries. | **P1** | **RESOLVED (Phase 2)** | `core/src/engine.ts`, `sqlite/src/index.ts`, `postgres/src/index.ts` | Normalized validation precedence and standardized `QueryError` / `UnsupportedOperationError`. |
| **AUD-05** | `search_audit.test.ts` contained no assertions (console.log only). | **P1** | **RESOLVED (Phase 1)** | `differential/test/search_audit*.test.ts` | Converted to strict differential assertions. |
| **AUD-06** | SQLite `LIKE` operator is ASCII-only case folding; PostgreSQL and InMemory fold Unicode. | **P1** | **RESOLVED & DOCUMENTED (Phase 5)** | `differential/test/search_adversarial.test.ts` | Formalized and documented SQLite platform boundary in `SEARCH.md`. |
| **AUD-07** | Traversal intermediate candidate frontier expansion unbounded during step loop. | **P1** | **RESOLVED (Phase 4)** | `core/src/engine.ts`, `sqlite/src/index.ts`, `postgres/src/index.ts` | Enforced intermediate level-by-level BFS candidate bounding ($\le \text{maxPaths}$). |
| **AUD-08** | `EFixtureMutator` individual mutation atomicity vs batch primitives. | **P1** | **RESOLVED & DOCUMENTED (Phase 6)** | `differential/test/mutation_transaction.test.ts` | Documented single-operation atomicity and connection lifecycle safety. |
| **AUD-09** | Search ordering uses UTF-16 code units (JS) vs UTF-8 byte comparison (SQL). | **P2** | **RESOLVED & DOCUMENTED (Phase 5)** | `engine.ts`, `sqlite/src/index.ts`, `postgres/src/index.ts` | BMP collation parity verified; non-BMP ordering documented in `SEARCH.md`. |
| **AUD-10** | Fresh schema vs incremental migrations equivalence and replay safety are incomplete. | **P1** | **IMPLEMENTED; LIVE VERIFICATION PENDING** | `packages/*/src/index.ts`, `packages/*/schema.sql` | Runtime version/history runners now exist for SQLite and PostgreSQL with transactional upgrade and concurrency policy; live PostgreSQL execution remains environment-gated outside local workspace. |
| **AUD-11** | SQLite parameter limits on large batched traversal lookups. | **P2** | **RESOLVED (Phase 8)** | `differential/test/scale_concurrency.test.ts` | Verified 500-parameter chunking preventing SQLite variable overflow. |
| **AUD-12** | Concurrent writer duplicate insertion races. | **P2** | **RESOLVED (Phase 8)** | `differential/test/scale_concurrency.test.ts` | Verified atomic constraint violation handling across concurrent writers. |
