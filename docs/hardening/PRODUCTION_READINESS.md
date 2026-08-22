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
| 3. Traversal hardening | COMPLETE (local; PostgreSQL execution pending) | Traversal adversarial: 9 passed; focused differential traversal: 20 passed; workspace: 87 passed, 1 skipped; build passed | PostgreSQL runtime traversal remains unverified; conservative partial signaling may over-report when an allocation is exactly full |
| 4. Result size / memory safety | COMPLETE (local; PostgreSQL execution pending) | Result-limit differential test: 10 passed; workspace: 89 passed, 1 skipped; build passed | PostgreSQL runtime result-limit execution remains unverified; pagination beyond limit is not yet cursor-based |
| 5. Search | COMPLETE (semantics; scale blocker remains) | Search adversarial/audit: 17 passed; build passed | Lexical substring search remains O(N); PostgreSQL execution remains unverified |
| 6. Resolution | COMPLETE (local; PostgreSQL execution pending) | Differential resolution suite: 12 passed; PostgreSQL branch skipped locally | PostgreSQL runtime resolution remains unverified |
| 7. Claims / documents / provenance / temporal | COMPLETE (persistence semantics) | Persistence round-trip suite: existing metadata tests pass; PostgreSQL execution pending | No temporal/provenance query capability; semantics are intentionally persistence-only |
| 8. PostgreSQL schema / migrations | IN PROGRESS | Schema lifecycle: 4 SQLite tests passed; PostgreSQL lifecycle skipped | No migration-history/version runner; SQLite migration 001 is not replay-safe; live PostgreSQL verification pending |
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

### F-0005 (RESOLVED in Phase 3)

- ID: F-0005
- severity: P1
- subsystem: Traversal resource budgeting
- problem: PostgreSQL and SQLite traversal fetched a whole frontier level with one global SQL `LIMIT` based on the remaining relation budget. A high-degree earlier node could consume that limit and starve later frontier nodes, suppressing otherwise valid paths. InMemory expanded frontier items serially, so it did not define the same fairness contract.
- root cause: Database row-fetch bounding was added as a global limit without a per-frontier allocation policy.
- affected engines: InMemory, SQLite, PostgreSQL; the observable divergence is most direct in SQL-backed traversal.
- reproduction: Create two frontier nodes, give the first node more matching relations than `maxRelationsExpanded`, give the second node one valid relation, and choose ordering so the first node's relations sort first. Traverse with the relation budget set below the first node's degree. The second node's edge is not fetched.
- fix: Added deterministic per-frontier allocation in both SQL adapters and round-robin expansion in all engines. Fetched/expanded work remains bounded by the remaining relation budget, and bounded allocations produce explicit partial metadata.
- regression test: `packages/differential/test/traversal_adversarial.test.ts` now verifies a high-degree frontier node cannot starve a later node.
- documentation impact: Updated `docs/hardening/TRAVERSAL.md` with allocation, fairness, and conservative partial-result semantics.
- remaining risk: PostgreSQL runtime execution remains gated; the conservative exact-allocation signal can report partial when no additional rows exist.

### F-0006 (RESOLVED in Phase 4)

- ID: F-0006
- severity: P1
- subsystem: Result size / memory safety
- problem: `findRelations`, `findClaims`, and `findDocuments` materialized every matching row with no caller-controlled bound.
- root cause: Only lexical search and traversal had explicit result limits in the public contract.
- affected engines: InMemory, SQLite, PostgreSQL.
- reproduction: Attach an unbounded number of relations, claims, or documents to one entity and issue the corresponding query; all rows were materialized.
- fix: Added optional `limit` to these query types, default 1,000 and capped at 10,000. SQL adapters fetch at most `limit + 1`, trim output, and report `metadata.partial` when rows are truncated.
- regression test: Bounded result test in `packages/differential/test/error_contract.test.ts`.
- documentation impact: Updated `docs/CONTRACT.md`, `docs/hardening/PRODUCTION_READINESS.md`, and the public types.
- remaining risk: The API currently supports bounded pages but not cursor/keyset pagination; PostgreSQL execution remains gated.

### F-0007 (OPEN — Search scale boundary)

- ID: F-0007
- severity: P1
- subsystem: Search scale
- problem: Lexical search uses arbitrary substring matching over entity name/slug, which is an O(N) scan in all backends for `%query%` patterns.
- root cause: The current contract requires substring semantics; ordinary B-tree indexes cannot accelerate arbitrary leading-wildcard searches.
- affected engines: InMemory, SQLite, PostgreSQL.
- reproduction: Search a large dataset with a short or empty query; each backend scans candidates and only bounds returned rows.
- fix: No speculative indexing change was made. The limitation is explicitly documented; future production-scale search requires a deliberate capability/contract decision such as trigram/full-text indexing or a separate search provider.
- regression test: Existing 1,000-entity scale test and 17 search adversarial/audit tests.
- documentation impact: Updated `docs/CONTRACT.md` and `docs/hardening/SEARCH.md` to state O(N) complexity and avoid production-scale claims.
- remaining risk: Search at 100k–1m entities may be too slow without a future indexed search design.

### F-0008 (RESOLVED in Phase 6)

- ID: F-0008
- severity: P2
- subsystem: Resolution semantics
- problem: The public contract did not clearly state whether resolution searched aliases, names, slugs, or identities, nor how ambiguous aliases behaved.
- root cause: Implementations were alias-only and deterministic, but the contract description was incomplete.
- affected engines: InMemory, SQLite, PostgreSQL.
- reproduction: Resolve a slug/name/identity value or an alias shared by multiple entities; behavior was implementation-defined to callers.
- fix: Documented exact alias-only resolution, exact namespace filtering, collision preservation, and entity-ID ordering without expanding the API.
- regression test: Added alias-only, namespace, ambiguity, case, slug, and name assertions to `packages/differential/test/differential.test.ts`.
- documentation impact: Updated `docs/CONTRACT.md`, `docs/hardening/PARITY.md`, and this document.
- remaining risk: PostgreSQL runtime execution remains gated.

### F-0009 (RESOLVED in Phase 7)

- ID: F-0009
- severity: P2
- subsystem: Claims/documents/provenance/temporal semantics
- problem: Persistence round-trip coverage existed, but the public contract did not clearly distinguish stored metadata from queryable temporal/provenance semantics.
- root cause: Capability flags and field types existed without a consolidated semantic boundary.
- affected engines: InMemory, SQLite, PostgreSQL.
- reproduction: Supply timestamp strings with offsets or domain-specific temporal labels; values round-trip, but no temporal filtering or normalization occurs.
- fix: Confirmed and documented exact opaque-string persistence, strict claim confidence, required claim source, document ownership lookup, and absence of temporal/provenance query behavior.
- regression test: Existing persistence round-trip coverage for entity/relation/claim/document metadata; PostgreSQL branch remains gated locally.
- documentation impact: Updated `docs/CONTRACT.md`, `docs/hardening/PERSISTENCE.md`, and this document.
- remaining risk: Consumers needing temporal reasoning or provenance ranking require a future explicit capability and contract extension.

### F-0010 (OPEN — Phase 8)

- ID: F-0010
- severity: P1
- subsystem: Schema and migration lifecycle
- problem: Migrations are not version-tracked or automatically applied. PostgreSQL migration 001 is statement-level idempotent, but SQLite migration 001 fails when replayed because it adds existing columns without guards.
- root cause: Migration files were introduced as manual SQL artifacts without a migration-history table, runner, transactional upgrade policy, or backend-specific replay guard.
- affected engines: SQLite and PostgreSQL operational lifecycle; fresh schema bootstrap remains separately testable.
- reproduction: Apply `packages/sqlite/migrations/001_add_provenance_and_identities.sql` twice to a legacy SQLite schema; the second application raises duplicate-column errors. No repository command records applied migration versions.
- fix: Not yet implemented. Requires a deliberate migration API/runner design, SQLite schema inspection guards, version recording, failure semantics, and concurrency policy.
- regression test: SQLite fresh schema lifecycle passes; PostgreSQL fresh/replay tests are skipped locally.
- documentation impact: Corrected `docs/hardening/MIGRATIONS.md`, added lifecycle boundary to `docs/hardening/SCHEMA.md`, and recorded this blocker.
- remaining risk: Production upgrades cannot yet be treated as automatically safe or replayable.

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
- [x] Traversal is bounded and deterministic for locally tested engines; PostgreSQL runtime verification pending
- [x] Traversal resource limits bound actual work for locally tested engines; PostgreSQL runtime verification pending
- [x] Large result sets are controlled with bounded limits; cursor pagination remains future work
- [x] Search semantics are explicit; arbitrary substring search remains an O(N) documented limitation
- [x] Resolution semantics are explicit and ambiguity-preserving; PostgreSQL runtime verification pending
- [x] Error taxonomy is useful for locally tested adapters; PostgreSQL runtime verification remains pending
- [ ] Batch writes are atomic
- [ ] Batch writes have defined retry/idempotency behavior
- [ ] Connection/pool lifecycle is safe
- [ ] Schema lifecycle is understood end-to-end
- [ ] Migration lifecycle is safe and version-tracked
- [x] Provenance/temporal semantics are documented as opaque persistence-only metadata
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

Phase 3 was in progress during the traversal audit and is now complete for locally available engines after resolving F-0005.

## Phase 3 record

Files changed: `packages/core/src/engine.ts`, `packages/sqlite/src/index.ts`, `packages/postgres/src/index.ts`, `packages/differential/test/traversal_adversarial.test.ts`, `docs/hardening/TRAVERSAL.md`, and this document.

Tests and commands run:

- Focused traversal suite — 9 passed.
- Focused differential traversal/randomized parity — 20 passed.
- `npm test` — core 14 passed, differential 73 passed, SQLite 4 passed, PostgreSQL 1 skipped; dependency check passed.
- `npm run build` — passed for all build-enabled workspaces.

Failures and remaining risks:

- No test or build failures.
- PostgreSQL traversal remains unverified because `TEST_DATABASE_URL` is unset.
- Vitest configuration deprecation warnings remain tracked as F-0003.

Phase 3 is complete for locally available engines. Phase 4 is now complete for locally available engines; the next phase is search semantics and scale review.

## Phase 4 record

Files changed: `packages/core/src/types.ts`, `packages/core/src/validation.ts`, `packages/core/src/engine.ts`, `packages/sqlite/src/index.ts`, `packages/postgres/src/index.ts`, `packages/differential/test/error_contract.test.ts`, `docs/CONTRACT.md`, and this document.

Tests and commands run:

- Result-limit differential test — 10 passed.
- `npm run build` — passed for all build-enabled workspaces.

Remaining risks:

- PostgreSQL result-limit execution remains unverified because `TEST_DATABASE_URL` is unset.
- Limits are offsetless bounded pages; cursor pagination is not implemented.

## Phase 5 record

Files changed: `packages/core/src/engine.ts`, `packages/sqlite/src/index.ts`, `packages/postgres/src/index.ts`, `docs/CONTRACT.md`, `docs/hardening/SEARCH.md`, and this document.

Tests and commands run:

- Search adversarial/audit suite — 17 passed.
- `npm run build` — passed for all build-enabled workspaces.

Remaining risks:

- F-0007 remains open: lexical substring search is O(N).
- PostgreSQL search execution remains unverified because `TEST_DATABASE_URL` is unset.

Phase 5 is complete as a semantic and capability audit, but it does not claim production-scale search.

## Phase 6 record

Files changed: `packages/differential/test/differential.test.ts`, `docs/CONTRACT.md`, `docs/hardening/PARITY.md`, and this document.

Tests and commands run:

- Focused differential resolution suite — 12 passed.
- `git diff --check` — passed.

Remaining risk: PostgreSQL resolution execution remains unverified because `TEST_DATABASE_URL` is unset.

Phase 6 is complete for locally available engines.

## Phase 7 record

Files changed: `docs/CONTRACT.md`, `docs/hardening/PERSISTENCE.md`, and this document.

Tests and commands run:

- Existing persistence round-trip suite is the regression basis for all first-class metadata fields; PostgreSQL branches remain environment-gated.

Remaining risk: temporal/provenance query capabilities are intentionally absent and must not be advertised by current engines.

Phase 7 is complete as a persistence and contract audit.

## Phase 8 record

Files changed: `docs/hardening/MIGRATIONS.md`, `docs/hardening/SCHEMA.md`, and this document.

Tests and commands run:

- Schema lifecycle suite — 4 passed locally; PostgreSQL branches skipped because `TEST_DATABASE_URL` is unset.

Remaining blocker: F-0010 remains open. Phase 8 is not complete; the repository has no safe, versioned migration lifecycle yet.
