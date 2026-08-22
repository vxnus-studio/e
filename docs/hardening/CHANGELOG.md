# Hardening Changelog

All notable hardening changes across the E runtime are recorded in this document.

---

## [Phase 9] - Traversal Safety & Atomic Batch Ingestion Hardening
- **P0-1: Traversal Resource Safety Remediation**:
  - Bound intermediate candidate relation expansion (`maxRelationsExpanded`, default 100,000) and entity hydration (`maxEntitiesHydrated`, default 50,000) across InMemory, SQLite, and PostgreSQL.
  - Implemented database-level `LIMIT` on intermediate edge fetch queries to protect memory on high-degree nodes.
  - Standardized truncation warning reasons in `metadata.warnings`.
  - Added adversarial resource bound tests in `packages/differential/test/traversal_adversarial.test.ts`.
- **P0-2: Multi-Record Atomic Ingestion Remediation**:
  - Defined `BatchDataset`, `BatchIngestResult`, and `EBatchMutator` in core domain types.
  - Implemented atomic `ingestBatch` with rollback on error for `InMemoryEngine` (snapshot restoration), `SqliteEngine` (`db.transaction`), and `PostgresEngine` (`BEGIN ... COMMIT / ROLLBACK`).
  - Added transactional rollback and multi-type atomic ingestion tests in `packages/differential/test/mutation_transaction.test.ts`.
- **Documentation**:
  - Authored `docs/hardening/PHASE-9.md`, updated `docs/hardening/TRAVERSAL.md`, `docs/hardening/MUTATIONS.md`, and `docs/hardening/ROADMAP.md`.

---

## [Phase 8] - Scale, Performance & Concurrency Hardening
- **Audited Scale Profiles & Concurrency Safety**:
  - Authored `docs/hardening/SCALE-BENCHMARKS.md` and `docs/hardening/CONCURRENCY.md`.
  - Updated `docs/hardening/SCALE.md` with complete operation complexity profiles.
- **Created Scale & Concurrency Test Suite**:
  - Authored `packages/differential/test/scale_concurrency.test.ts` testing 1,000-entity point lookups and filtered searches, 600-node SQLite parameter chunking safety, concurrent reader-writer connection pool stability, and concurrent duplicate insertion races.
- **Reconciled Full Forensic Audit Matrix**:
  - Reconciled AUD-01 through AUD-12 in `docs/hardening/AUDIT.md`.

---

## [Phase 7] - Schema, Migration, Fresh Install, and Replay Hardening
- Verified fresh PostgreSQL and SQLite database bootstrapping.
- Verified migration replay against legacy databases with data preservation.
- Documented schema in `docs/hardening/SCHEMA.md` and `docs/hardening/MIGRATIONS.md`.

---

## [Phase 6] - Mutation Atomicity, Transactions, and Bulk Fixture Safety
- Audited mutation & connection lifecycle invariants in `TRANSACTIONS.md` and `MUTATIONS.md`.
- Created mutation atomicity test suite in `packages/differential/test/mutation_transaction.test.ts`.

---

## [Phase 5] - Search Semantics and Cross-Backend Parity
- Established search contract in `docs/hardening/SEARCH.md`.
- Created adversarial search test suite in `packages/differential/test/search_adversarial.test.ts`.

---

## [Phase 4] - Traversal Hardening
- Bounded intermediate candidate frontier ($\le \text{maxPaths}$) across all three engines.
- Unified `metadata.partial` flag and warnings.
- Created `traversal_adversarial.test.ts`, `TRAVERSAL.md`, and `SCALE.md`.

---

## [Phase 3] - Persistence Correctness
- Resolved [P0] SQL metadata persistence loss across SQLite and PostgreSQL mutators.
- Resolved [P0] InMemory object reference leakage via `structuredClone` deep-cloning.
- Created `persistence_roundtrip.test.ts` and `PERSISTENCE.md`.

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
