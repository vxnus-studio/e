# Testing Strategy & Harness Audit (Phase 1 Update)

This document outlines the verified testing architecture, differential suites, and current state of verification across all backends.

---

## 1. Test Suite Structure

The repository contains three levels of testing:

1. **Unit & Engine Behavioral Tests** (`packages/core/test/behavior.ts`):
   - Reusable test matrix parameterized over engine setup functions.
   - Executed against `InMemoryEngine` (`packages/core/test/engine.test.ts`), `SqliteEngine` (`packages/sqlite/test/sqlite.test.ts`), and `PostgresEngine` (`packages/postgres/test/postgres.test.ts`).
2. **Differential Parity Tests** (`packages/differential/test/differential.test.ts`):
   - Executes identical fixtures and queries across InMemory, SQLite, and PostgreSQL simultaneously.
   - **Phase 1 Invariant Added**: Strictly asserts engine instance isolation (`Harness invariant: each test backend mutates only its own storage`) to prevent cross-backend fixture mutation bleeding.
3. **Differential Truth & Audit Suites** (`packages/differential/test/*`):
   - `persistence_roundtrip.test.ts`: Asserts round-trip preservation of primary fields, metadata (`identities`, `provenance`, `temporal`, `metadata`), and tests InMemory reference isolation.
   - `search_audit.test.ts`: Strict assertions on empty queries, whitespace, wildcard escaping (`%` and `_`), limit boundaries, and ASCII case folding.
   - `search_audit_case.test.ts`: Strict assertions on accented/Unicode case folding parity and explicit SQLite ASCII `LIKE` divergence.
   - `capabilities.test.ts`: Asserts capability matrix truth across all backends; verifies that unsupported modes (`semantic`, `hybrid`) strictly throw `UnsupportedOperationError`.
   - `error_contract.test.ts`: Asserts error semantics, not-found behavior, malformed query rejections, constraint violations, and traversal parameter validation ordering.

---

## 2. Test Harness Repairs & Fixes Completed in Phase 1

| Component | Previous Flaw | Phase 1 Fix & Verification | Status |
|---|---|---|---|
| `packages/differential/test/differential.test.ts` | PostgreSQL fixture inserter delegated to `sqliteEngine.insertEntity` (lines 81-87). | Replaced with direct `pgEngine.insert*` calls. Added `Harness Integrity & Backend Isolation` test asserting zero cross-backend state bleeding. | **FIXED & VERIFIED** |
| `packages/differential/test/search_audit.test.ts` | Contained 7 test cases with `console.log` and zero `expect()` assertions. | Replaced all logging with strict cross-backend `expect()` assertions. | **FIXED & VERIFIED** |
| `packages/differential/test/search_audit_case.test.ts` | Contained 1 test case with `console.log` and zero `expect()` assertions. | Converted into 3 strict differential tests asserting Unicode case folding. | **FIXED & VERIFIED** |
| `packages/differential/test/capabilities.test.ts` | Weak error checking on unsupported modes. | Enforced strict `UnsupportedOperationError` assertion on `semantic` and `hybrid` search modes. | **FIXED & VERIFIED** |
| Metadata Persistence | Zero tests for `identities`, `provenance`, `temporal`, `metadata`. | Created `persistence_roundtrip.test.ts` testing every first-class type across all 3 backends. | **TESTS CREATED** |

---

## 3. Investigating Skipped Tests

### `packages/postgres/test/postgres.test.ts`
- **Local state**: Skipped when `TEST_DATABASE_URL` is not provided, so local development does not require a database server.
- **CI state**: `.github/workflows/ci.yml` provisions PostgreSQL, sets `TEST_DATABASE_URL`, runs `scripts/verify-postgres.cjs`, and fails if the server is unreachable. Differential PostgreSQL initialization failures also fail under `CI` instead of silently removing PostgreSQL from the matrix.

---

## 4. Summary of Differential Suite Proofs

### What the differential suite proves:
1. **Constraint Parity**: Duplicate primary keys and orphaned foreign keys are rejected uniformly with `ConstraintError` across InMemory, SQLite, and PostgreSQL.
2. **Traversal Determinism**: Complex DAGs, cycles, and randomized graphs produce identical path structures, edge direction labels, and sorting orders across all three backends.
3. **Resolve Case-Sensitivity**: Alias resolution is strictly case-sensitive across all three backends (`"MixedCase"` matches, `"mixedcase"` does not).
4. **Search Wildcard Escaping**: Wildcards `%` and `_` are strictly escaped and treated as literal characters across all backends.
5. **Capabilities Contract**: All backends declare identical capability structures and throw `UnsupportedOperationError` for unadvertised modes.

### What the differential suite does NOT prove (Phase 0/1 Limitations):
1. **Metadata Persistence Parity**: SQLite and PostgreSQL adapters currently drop `identities`, `provenance`, `temporal`, and relation `metadata` on insert (confirmed by `persistence_roundtrip.test.ts`).
2. **InMemory Object Isolation**: `InMemoryEngine` mutates in-place if the caller mutates its input object reference.
3. **Traversal Input Validation Ordering**: In `PostgresEngine`, invalid `maxDepth` is validated before entity lookup; in `InMemoryEngine` and `SqliteEngine`, entity existence is checked first.
