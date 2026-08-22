# Hardening Changelog

All notable hardening changes across the E runtime are recorded in this document.

---

## [Phase 4] - Traversal Hardening
- **Bounded Intermediate Candidate Frontier**:
  - Refactored `InMemoryEngine` (`packages/core/src/engine.ts`), `SqliteEngine` (`packages/sqlite/src/index.ts`), and `PostgresEngine` (`packages/postgres/src/index.ts`) traversal algorithms to enforce level-by-level BFS with strict intermediate candidate frontier bounding ($\le \text{maxPaths}$).
  - Unified `metadata.partial` flag and warnings calculation across all three engines so that truncation triggers if and only if intermediate expansion or path collection was bounded.
- **Created Traversal Adversarial & Parity Test Suite**:
  - Authored `packages/differential/test/traversal_adversarial.test.ts` testing converging diamond graphs (confirming path-local visited preservation), 3-node cycle termination, self-loops, dense 1-to-100 fan-out bounding with `maxPaths=2`, bidirectional incoming/outgoing traversal, and cross-backend deterministic path sort parity.
- **Documented Traversal Specification & Scaling Profile**:
  - Authored `docs/hardening/TRAVERSAL.md` and `docs/hardening/SCALE.md`.

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
