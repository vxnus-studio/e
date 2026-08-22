# Forensic Audit Matrix (Phase 4 Update)

## Executive Summary

This forensic audit establishes the verified state of the `E` knowledge runtime codebase (`@vxnus/e`, `@vxnus/e-sqlite`, `@vxnus/e-postgres`, and `@vxnus/differential`).

---

## 1. Severity-Ranked Findings Table

| ID | Severity | Area | Finding | Status / Phase | Evidence | Risk | Resolution Summary |
|---|---|---|---|---|---|---|---|
| **AUD-01** | **P0** | **Test Infrastructure** | `differential.test.ts` Postgres insert fixture accidentally mutated SQLite engine. | **RESOLVED (Phase 1)** | `packages/differential/test/differential.test.ts:81-87` | Postgres differential suite was bypassed. | Fixed in Phase 1; isolation invariant test added. |
| **AUD-02** | **P0** | **Persistence** | Metadata fields (`provenance`, `temporal`, `identities`, `metadata`) were dropped on insert in SQLite & Postgres adapters. | **RESOLVED (Phase 3)** | `packages/sqlite/src/index.ts:536` & `packages/postgres/src/index.ts:448` | Severe silent data loss for lineage, external IDs, and temporal data. | Fixed in Phase 3; all metadata columns written and verified via round-trip suite. |
| **AUD-03** | **P0** | **Persistence / InMemory Parity** | `InMemoryEngine` stored object references directly without cloning. | **RESOLVED (Phase 3)** | `packages/core/src/engine.ts:25-70` | Caller mutating input or returned objects modified stored DB state. | Fixed in Phase 3; deep cloning via `structuredClone` on both insert and query return. |
| **AUD-04** | **P1** | **Error Semantics** | Inconsistent error classes and validation ordering across engines on malformed inputs and unknown query types. | **RESOLVED (Phase 2)** | `packages/core/src/engine.ts`, `sqlite/src/index.ts`, `postgres/src/index.ts` | Callers received generic `Error` or mismatched ordering. | Normalized validation order and standardized `QueryError` / `UnsupportedOperationError` in Phase 2. |
| **AUD-05** | **P1** | **Testing Integrity** | `search_audit.test.ts` only logged outputs without assertions. | **RESOLVED (Phase 1)** | `packages/differential/test/search_audit*.test.ts` | False confidence. | Converted to strict differential assertions in Phase 1. |
| **AUD-06** | **P1** | **Search Parity** | SQLite `LIKE` operator is ASCII-only case folding; PostgreSQL and InMemory fold Unicode. | **DOCUMENTED PLATFORM LIMIT** | `test/search_audit_case.test.ts` | Non-ASCII search divergence on SQLite. | Documented in `CONTRACT.md` and `PARITY.md`. |
| **AUD-07** | **P1** | **Traversal Safety** | Traversal intermediate candidate frontier expansion unbounded during step loop. | **RESOLVED (Phase 4)** | `packages/core/src/engine.ts`, `sqlite/src/index.ts`, `postgres/src/index.ts` | Memory spikes and non-uniform partial flags on dense graphs. | Bounded intermediate level expansion to `maxPaths` across all engines. |
| **AUD-08** | **P1** | **Transactions / Mutations** | `EFixtureMutator` lacks atomic batch or rollback abstraction. | **OPEN (Slated Phase 6)** | `packages/core/src/types.ts:172-178` | Partial-write corruption on batch loads. | Implement transaction abstraction in Phase 6. |
| **AUD-09** | **P2** | **Ordering Collation Divergence** | Search ordering uses UTF-16 code units (JS) vs UTF-8 byte comparison (SQL). | **OPEN (Slated Phase 5)** | `engine.ts:199` vs `postgres/src/index.ts:158` | Divergence on non-BMP characters. | Harmonize or document boundary in Phase 5. |
| **AUD-10** | **P2** | **Schema & Migrations** | Fresh schema vs incremental migrations equivalence unverified. | **OPEN (Slated Phase 7)** | `postgres/schema.sql` vs migrations | Schema drift risk. | Add replay test in Phase 7. |
