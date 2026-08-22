# E Production Readiness

## Status

- Current phase: Phase 0 complete; Phase 1 ready to begin
- Overall status: HARDENING
- Date: 2026-08-22
- HEAD: `a3fec09` (`hardening(p0-4): validate query inputs at runtime`)
- Scope: E only. `e-teyvat` is out of scope.

Phase 0 established the current repository baseline without source changes. E is not production-ready: PostgreSQL behavior was not exercised in this environment, and the initial contract/storage audit found known constraint mismatches to resolve in Phase 1.

## Hardening phases

| Phase | Status | Tests | Remaining Risk |
|------|--------|-------|----------------|
| 0. Baseline | COMPLETE | `npm test`: 78 passed, 1 skipped; `npm run build`: passed | PostgreSQL suite skipped locally; baseline has Vitest deprecation warnings and known schema/validator length mismatches |
| 1. Contract ↔ storage parity | COMPLETE (local; PostgreSQL execution pending) | Boundary suite: 9 passed; workspace: 88 passed, 1 skipped; build passed | Live PostgreSQL boundary execution remains unavailable locally; JSON/provenance field limits remain validator-level |
| 2. Error model | COMPLETE (local; PostgreSQL execution pending) | Workspace: 88 passed, 1 skipped; closed SQLite database test passed; build passed | Live PostgreSQL outage/rollback-failure tests remain unavailable |
| 3. Traversal hardening | IN PROGRESS | Existing adversarial suite passes locally; new starvation finding under audit | SQL global fetch limits can starve later frontier nodes; fair bounded expansion contract is not implemented yet |
| 4. Result size / memory safety | PENDING | Existing tests only | Claims, documents, relations, and search result materialization need explicit limits/pagination review |
| 5. Search | PENDING | Existing tests only | SQLite Unicode folding and cross-backend collation differences remain documented divergences; scale claims need verification |
| 6. Resolution | PENDING | Existing tests only | Alias/name/slug/identity semantics need an explicit current contract and collision tests |
| 7. Claims / documents / provenance / temporal | PENDING | Existing tests only | Persistence is tested in selected paths, but temporal query semantics and limits are not established |
| 8. PostgreSQL schema / migrations | PENDING | Existing tests only; PostgreSQL skipped locally | Migration files are not visibly tracked by a migration table; fresh/upgrade/replay behavior requires live PostgreSQL verification |
| 9. Batch ingestion | PENDING | Existing tests only | Atomicity exists in code/tests, but batching cost, size bounds, retry, and idempotency semantics remain open |
| 10. Concurrency / connection safety | PENDING | Existing tests only | PostgreSQL pool and failure behavior are unverified without a live database |
| 11. Scale review | PENDING | Existing 1k-scale tests | 100k/1m behavior and actual query plans are not established |
| 12. Differential / adversarial testing | PENDING | 72 differential tests currently pass without PostgreSQL | Three-backend parity is incomplete locally because PostgreSQL is skipped |
| 13. Current-head verification | PENDING | Not run | Final readiness cannot be assessed until all phases and live PostgreSQL verification complete |

## Findings

### F-0001 (RESOLVED in Phase 1)

- ID: F-0001
- severity: P1
- subsystem: Contract ↔ SQL storage constraints
- problem: Runtime validators and PostgreSQL schema disagreed on maximum string lengths. SQLite also had no equivalent length checks.
- root cause: Field limits were duplicated in `validation.ts` and SQL schemas instead of being represented as an explicit shared contract.
- affected engines: InMemory, SQLite, PostgreSQL.
- reproduction: Before Phase 1, a 256-character identifier-like value was accepted by validation and SQLite but rejected by PostgreSQL `VARCHAR(255)`.
- fix: Added shared 255-character storage constants, aligned core validation, counted Unicode code points, and added SQLite checks matching PostgreSQL. Long-form statement/content fields remain unrestricted by design.
- regression test: `packages/core/test/validation-boundaries.test.ts` (9 tests) and SQLite schema boundary test.
- documentation impact: Updated `docs/hardening/SCHEMA.md` and this contract decision.
- remaining risk: PostgreSQL boundary execution is pending a live test database; JSON/provenance nested-field limits are enforced by runtime validation rather than SQL field constraints.

### F-0002

- ID: F-0002
- severity: P1
- subsystem: Verification coverage
- problem: PostgreSQL tests are skipped when `TEST_DATABASE_URL` is absent.
- root cause: The adapter test suite is environment-gated and this environment has no configured PostgreSQL test URL.
- affected engines: PostgreSQL and all three-backend differential claims.
- reproduction: Run `npm test` without `TEST_DATABASE_URL`; the PostgreSQL package reports one skipped test and differential PostgreSQL branches are not exercised.
- fix: Phase 13 must run the suite against a live PostgreSQL instance or explicitly retain the environment as a documented blocker.
- regression test: Existing PostgreSQL package and differential suites, currently skipped locally.
- documentation impact: Every parity phase must distinguish two-backend local results from three-backend results.
- remaining risk: Passing local tests does not establish PostgreSQL parity.

### F-0003

- ID: F-0003
- severity: P2
- subsystem: Test/build tooling
- problem: Vitest reports that `test.poolOptions` was removed in Vitest 4, and warns that the TypeScript config is loaded as CommonJS despite ESM syntax.
- root cause: Repository test configuration has not been updated to the current installed Vitest/Vite configuration contract.
- affected engines: Test harness and all packages; no test failure observed.
- reproduction: Run `npm test` or any workspace Vitest command.
- fix: Review and update configuration in a tooling-focused hardening change after confirming the correct Vitest 4 settings.
- regression test: Workspace tests and build.
- documentation impact: Record warning-free verification criteria for Phase 13.
- remaining risk: Deprecated configuration may become a hard failure after dependency updates.

### F-0004 (RESOLVED in Phase 2)

- ID: F-0004
- severity: P1
- subsystem: Error translation
- problem: Unexpected SQLite and PostgreSQL driver failures were converted to `QueryError`, conflating storage outages with malformed requests.
- root cause: Adapter query catch blocks had only the public request/constraint error classes available and used `QueryError` as the generic fallback.
- affected engines: SQLite and PostgreSQL adapters.
- reproduction: Query a closed SQLite database; the prior implementation returned a generic `QueryError`.
- fix: Added and exported `StorageError`; adapter query and mutation fallbacks now preserve the driver error as `cause`, and PostgreSQL rollback failure is reported as `TRANSACTION_ROLLBACK_FAILED`.
- regression test: SQLite closed-database test in `packages/sqlite/test/sqlite.test.ts`; existing error contract suite continues to pass.
- documentation impact: Updated `docs/hardening/ERRORS.md` and this document.
- remaining risk: PostgreSQL connection, SQL, and rollback-failure behavior requires live backend execution.

### F-0005 (OPEN — Phase 3)

- ID: F-0005
- severity: P1
- subsystem: Traversal resource budgeting
- problem: PostgreSQL and SQLite traversal fetch a whole frontier level with one global SQL `LIMIT` based on the remaining relation budget. A high-degree earlier node can consume that limit and starve later frontier nodes, suppressing otherwise valid paths. InMemory expands frontier items serially, so it does not currently define a fair cross-backend contract either.
- root cause: Database row-fetch bounding was added as a global limit without a per-frontier allocation policy.
- affected engines: InMemory, SQLite, PostgreSQL; the observable divergence is most direct in SQL-backed traversal.
- reproduction: Create two frontier nodes, give the first node more matching relations than `maxRelationsExpanded`, give the second node one valid relation, and choose ordering so the first node's relations sort first. Traverse with the relation budget set below the first node's degree. The second node's edge is not fetched.
- fix: Define deterministic round-robin/per-frontier allocation, keep fetched rows bounded by the total remaining budget, and preserve explicit partial metadata when work is truncated.
- regression test: Required in `packages/differential/test/traversal_adversarial.test.ts` for InMemory, SQLite, and PostgreSQL when available.
- documentation impact: Update `docs/hardening/TRAVERSAL.md` with the fairness and partial-result contract.
- remaining risk: Until fixed, `maxRelationsExpanded` bounds returned work but can bias which frontier nodes receive work.

## Contract decisions

No new semantic decisions were made in Phase 0. Existing documented decisions remain provisional until revalidated against current code and all backends, including:

- absence of data is represented as an empty result, not a not-found exception;
- malformed requests use `QueryError`, unsupported capabilities use `UnsupportedOperationError`, and integrity violations use `ConstraintError`;
- traversal is intended to be deterministic, cycle-safe, and bounded;
- lexical search is substring-based, with documented SQLite Unicode limitations.

Phase 1 decision: identifier-like and short textual storage fields have a 255-character limit; long-form claim statements and document content are unrestricted `TEXT`; nested provenance and identity fields retain explicit validator-level limits.

## Backend parity matrix

| Capability | InMemory | PostgreSQL | SQLite | Same semantics? | Tested? | Risk |
|---|---|---|---|---|---|---|
| Runtime entity validation | Shared validator | Shared validator + SQL constraints | Shared validator + SQLite checks | Yes for documented scalar lengths | Partial | PostgreSQL execution pending |
| Primary-key uniqueness | Enforced in maps/arrays | Enforced by primary keys | Enforced by primary keys | Intended yes | Yes, PostgreSQL locally skipped | P1 |
| Foreign-key integrity | Explicit checks | Foreign keys | Foreign keys | Intended yes | Partial | P1 |
| Lexical search | In-memory scan | `ILIKE` scan | `LIKE` scan | Documented Unicode divergence | Partial | P1 |
| Traversal | Bounded BFS | Bounded SQL-backed BFS | Bounded SQL-backed BFS | Not yet proven at current HEAD | Partial | P1 |
| Claims/documents result size | No explicit query limit | No explicit query limit | No explicit query limit | Yes, but potentially unbounded | No adversarial limit audit | P1 |
| Batch ingestion | Snapshot rollback | SQL transaction | SQL transaction | Intended atomicity | Partial | P1 |
| PostgreSQL connection failures | N/A | Not locally exercised | N/A | Not applicable | No | P1 |

## Production readiness checklist

- [ ] Contract and database constraints agree
- [ ] All engines agree on documented semantics
- [ ] Traversal is bounded and deterministic
- [ ] Traversal resource limits bound actual work
- [ ] Large result sets are controlled
- [ ] Search semantics are explicit
- [ ] Resolution semantics are explicit
- [x] Error taxonomy is useful for locally tested adapters; PostgreSQL runtime verification remains pending
- [ ] Batch writes are atomic
- [ ] Batch writes have defined retry/idempotency behavior
- [ ] Connection/pool lifecycle is safe
- [ ] Schema lifecycle is understood
- [ ] Migration lifecycle is safe
- [ ] Provenance/temporal semantics are documented
- [ ] Scale envelope is documented
- [ ] Current HEAD passes the complete suite
- [ ] Hardening documentation is up to date
- [ ] No known P0 blockers remain

## Remaining blockers

1. PostgreSQL cannot be considered verified until the suite runs against a live `TEST_DATABASE_URL`.
2. Field-length semantics are inconsistent between validation, SQLite, and PostgreSQL.
3. The complete hardening program has not yet audited all result-size, traversal-work, error, migration, batch, concurrency, and scale contracts at this HEAD.

## Phase 0 record

Files changed: `packages/core/src/types.ts`, `packages/core/src/validation.ts`, `packages/core/test/validation-boundaries.test.ts`, `packages/sqlite/schema.sql`, `packages/sqlite/src/index.ts`, `packages/sqlite/test/sqlite.test.ts`, `docs/hardening/SCHEMA.md`, and this document.

Tests and commands run:

- Focused boundary test — passed: 9 tests.
- `npm test` — passed: core 14, differential 72, SQLite 2; PostgreSQL 1 test skipped; dependency check passed.
- `npm run build` — passed for all build-enabled workspaces.
- Repository inspection covered package manifests, TypeScript configs, source, tests, schemas, migrations, CI, exports, README, and hardening documentation.

Failures and warnings:

- No test or build failures.
- PostgreSQL was skipped because `TEST_DATABASE_URL` was not set.
- Vitest emitted the existing `poolOptions` deprecation warning and Vite ESM/CommonJS config warning.

Phase 0 is complete because the baseline is recorded. Phase 1 and the locally verifiable portion of Phase 2 are complete; PostgreSQL runtime verification remains a documented blocker.

## Phase 2 record

Files changed: `packages/core/src/errors.ts`, `packages/sqlite/src/index.ts`, `packages/postgres/src/index.ts`, `packages/sqlite/test/sqlite.test.ts`, `docs/hardening/ERRORS.md`, and this document.

Tests and commands run:

- `npm run test --workspace=@vxnus/e-sqlite` — 4 passed, including closed-database `StorageError` behavior.
- `npm test` — core 14 passed, differential 72 passed, SQLite 4 passed, PostgreSQL 1 skipped; dependency check passed.
- `npm run build` — passed for all build-enabled workspaces.
- `git diff --check` — passed.

Failures and remaining risks:

- No test or build failures.
- PostgreSQL remains environment-gated and was not exercised.
- Vitest configuration deprecation warnings remain and are tracked as F-0003.

Phase 2 is complete for the implementation and locally available backends. It is not evidence that PostgreSQL runtime failure paths have passed until `TEST_DATABASE_URL` is available.

Phase 3 is in progress. Its first open finding is F-0005; no traversal implementation change is being claimed yet.
