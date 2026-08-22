# Hardening Changelog

All notable hardening changes across the E runtime are recorded in this document.

---

## [Phase 5] - Search Semantics and Cross-Backend Parity
- **Established Search Contract & Specification**: Authored `docs/hardening/SEARCH.md` formalizing lexical matching, literal wildcard (`%`, `_`) and escape (`\`) handling, filter scoping, and limit boundaries.
- **Created Adversarial Search Test Suite**: Authored `packages/differential/test/search_adversarial.test.ts` testing ASCII case-insensitivity, literal SQL wildcard and backslash escaping, namespace/kind filters, limit bounds, deterministic ordering, CJK/Greek/Cyrillic/Emoji handling, and documented SQLite Unicode boundaries.
- **Verified Cross-Backend Search Equivalence**: Confirmed deterministic ordering and parameter filtering parity across InMemory, SQLite, and PostgreSQL.

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
