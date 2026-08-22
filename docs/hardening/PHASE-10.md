# Phase 10 Hardening: Contract, Error, Ordering & Input Correctness

## Summary of Completed Work

Phase 10 addresses the P1 contract and verification integrity requirements:
1. **P1-1: Runtime Contract & Input Validation**: Established centralized runtime validation (`validateEntity`, `validateAlias`, `validateRelation`, `validateClaim`, `validateDocument`, `validateBatchDataset`) checking non-empty strings, whitespace trimming, allowable lengths, confidence enum constraints, and valid nested objects/arrays across all engines.
2. **P1-2: Error Taxonomy & Parity**: Ensured uniform mapping where domain constraint violations (unique, foreign key, check, and input validation failures) map to `ConstraintError`, malformed queries map to `QueryError`, and unsupported features map to `UnsupportedOperationError` across InMemory, SQLite, and PostgreSQL.
3. **P1-3: Deterministic Result Ordering**: Enforced canonical sorting (`ORDER BY id COLLATE "C" ASC` in Postgres, `ORDER BY id COLLATE BINARY ASC` in SQLite, and lexicographical `.sort()` in InMemory) across `resolve`, `findRelations`, `findClaims`, and `findDocuments`.
4. **P1-4: Cascade Deletion & False-Confidence Test Remediation**: Rewrote the cascade deletion test in `packages/differential/test/mutation_transaction.test.ts` to actually execute parent entity deletion via SQL `DELETE` / state eviction and assert cascading deletion of all child records (aliases, relations, claims, documents).

---

## 1. Runtime Contract & Input Validation (P1-1)

Shared validation functions in `@vxnus/e` validate inputs at the core boundary before persistence:
- **Entity**: Non-empty `id`, `namespace`, `kind`, `slug`, `name`; optional object `data`; validated `identities`, `provenance`, and `temporal` sub-structures.
- **Alias**: Non-empty `id`, `entityId`, and `alias`.
- **Relation**: Non-empty `id`, `subjectId`, `predicate`, and `objectId`; optional object `metadata`.
- **Claim**: Non-empty `id`, `entityId`, `statement`, and `source`; `confidence` strictly constrained to `'canon' | 'theory' | 'outdated' | 'unverified'`.
- **Document**: Non-empty `id`, `entityId`, string `content`.
- **Batch Dataset**: Validates every constituent array element prior to beginning transaction.

---

## 2. Error Taxonomy (P1-2)

| Error Class | Scope & Usage | Backend Behavior Parity |
|---|---|---|
| `ConstraintError` | Unique violations, foreign key failures, check constraints, runtime input validation errors | Thrown consistently across InMemory, SQLite, and PostgreSQL |
| `QueryError` | Malformed query requests, missing required query arguments (e.g. missing subjectId/objectId in `findRelations`) | Thrown consistently across InMemory, SQLite, and PostgreSQL |
| `UnsupportedOperationError` | Unknown query types, unsupported search modes (e.g. semantic/hybrid when unsupported) | Thrown consistently across InMemory, SQLite, and PostgreSQL |

---

## 3. Deterministic Result Ordering (P1-3)

- **`resolve`**: Ordered by `entity.id ASC`.
- **`findRelations`**: Relations ordered by `relation.id ASC`; hydrated related entities ordered by `entity.id ASC`.
- **`findClaims`**: Ordered by `claim.id ASC`.
- **`findDocuments`**: Ordered by `document.id ASC`.
- **`search`**: Ordered by `entity.id ASC`.
- **`traverse`**: Deterministic level traversal and path ordering (`depth ASC, relationIds ASC, endId ASC`).

---

## 4. Test Verification Results

- **All Workspaces**:
  - Total test files: 13
  - Total tests executed: 68
  - Total tests passed: 68
  - Total skipped: 1 (PostgreSQL suite skipped in CI when `TEST_DATABASE_URL` is omitted).
