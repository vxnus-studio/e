# Hardening Changelog

All notable hardening changes across the E runtime are recorded in this document.

---

## [Phase 6] - Mutation Atomicity, Transactions, and Bulk Fixture Safety
- **Audited Mutation & Connection Lifecycle Invariants**:
  - Authored `docs/hardening/TRANSACTIONS.md` and `docs/hardening/MUTATIONS.md` documenting single-operation atomicity, foreign-key integrity, cascade rules, topological dependency ordering, and PostgreSQL connection pool safety.
- **Created Mutation Atomicity Test Suite**:
  - Authored `packages/differential/test/mutation_transaction.test.ts` asserting single-mutation constraint violation handling, rejection of orphan foreign keys without state corruption, cascade deletion validation, and PostgreSQL connection pool leak prevention.

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
