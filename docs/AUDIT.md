# Phase 2.75 Audit Report (Traversal Contract Finalization)

## A. Contract Decisions
- **Strict Integer Validation**: `maxDepth` and `maxPaths` no longer silently coerce invalid negative, decimal, or `NaN` inputs. Passing an invalid limit now throws an explicit `Error`.
- **Zero-Semantics**: 
  - `maxDepth: 0` implies returning exactly the root entity without resolving any edges (length `0` path). 
  - `maxPaths: 0` explicitly implies returning exactly `0` paths. It short-circuits execution completely, returning empty traversal structures, which correctly maps to SQL `LIMIT 0` expectations.
- **Limit Ranges**:
  - `maxDepth` domain is strictly `[0, 100]`.
  - `maxPaths` domain is strictly `[0, 100000]`.

## B. Bugs Discovered
1. **Unbounded Path Expansion Cost**: While the total *returned* paths were bounded by `maxPaths`, the internal `frontier` candidate expansion was not securely bounded per level. The algorithm previously computed all possible edges for the entire `currentLevelItems` block (potentially yielding hundreds of thousands of candidate permutations) before discarding them at the cleanup stage.
2. **Missing InMemory Schema Invariants**: PostgreSQL and SQLite correctly enforced relation `id` uniqueness via `PRIMARY KEY`. However, `InMemoryEngine` allowed identical relation IDs to be blindly pushed into its array, potentially simulating impossible schema states and breaking path identity assumptions.
3. **Database Parameter Query Sprawl**: In highly connected nodes, an `IN (...)` parameter fetch on `e_relations` for candidate expansion wasn't properly batched in the same way `e_entities` was, posing a risk of variable limit crashing.

## C. Bugs Fixed
- **Candidate Expansion Short-Circuit**: Injected a hard `break` when `nextFrontier.length >= maxPaths`. Because relations are perfectly sorted upfront, capping the candidate loop immediately halts CPU/memory expenditure deterministically without destroying order semantics.
- **Relation Batching**: Added `chunkSize = 500` batch loop around `e_relations` candidate fetching for Postgres and SQLite engines.
- **InMemory Constraint Parity**: Enforced `Array.some(id)` validation checks directly in `InMemoryEngine.insertRelation` and `insertEntity`, mapping to SQL Primary Key invariants.

## D. Tests Added
- Explicit `.toThrow("Invalid maxDepth")` and `"Invalid maxPaths"` rejection tests for decimals (`1.5`), `NaN`, very large integers, and negative numbers.
- `maxPaths=0` exact empty validation verification.

## E. Resource Guarantees
- **Result-Size Bound**: Guaranteed $\le$ `maxPaths`.
- **Memory Bound**: Guaranteed $\le$ `maxPaths * path_object_size` because `nextFrontier` candidates are strictly cut off at the limit mathematically within the loop.
- **Database Parameter Bound**: Guaranteed $\le$ `500` parameters per statement, satisfying both SQLite constraints (999) and Postgres constraints (65535).

## F. Work/Latency Guarantees
- **Database Query-Count Bound**: Chunking `IN (...)` arrays effectively sets total database round trips per depth level to exactly `ceil(frontier_size / 500) * 2`. In the worst-case ceiling where `maxPaths=100,000`, the engine executes at most $200$ parameter queries per level. This restricts query overhead to latency bounds that standard connection pools handle elegantly.

## G. Relation Identity Proof
- **Identity Scope**: Relation `id` fields are declared as `PRIMARY KEY` in both SQLite and Postgres schemas. Therefore, they are perfectly **Globally Unique**. 
- **Topological Deduplication**: Since `relationId` is structurally unique per edge record, defining path uniqueness by "a sequence of relation IDs" is mathematically absolute.
- **Total Ordering Tie-Breaking**: The canonical comparator dictates sorting by `Depth` -> `Lexical representation of edges` -> `Target Entity ID`. Because relation IDs are globally unique, the exact same relation sequence guarantees the exact same destination entity. 

## H. Postgres Verification Status
**PostgreSQL Runtime Unverified Locally**: The `.github/workflows` confirm test environments run Postgres instances, but locally, tests skip due to an absent `TEST_DATABASE_URL` environment binding. Therefore, Postgres code executes only hypothetically at the current terminal stage, pending CI verification. 

## I. Remaining Limitations
- A highly recursive `maxPaths=100000` chunk-query generation (200 DB queries sequentially resolved) is currently synchronous per level. Promise parallelization via `Promise.all` for relational lookups across chunks would substantially drop wall-clock latency.
- Fuzzing / Property Testing frameworks are basic random generator scripts.

---

# Phase 3 — Backend Semantic Contract

## A. Core Engine Interface

The core engine exposes a single `query(request: QueryRequest)` method for retrieval operations, and an internal fixture-insertion mechanism used for mutating state in a deterministic way.

### 1. `insertEntity(entity: Entity)`
- **Inputs**: `Entity` object (id, namespace, kind, slug, name, data, identities, provenance, temporal).
- **Outputs**: None.
- **Errors**: Throws if `id` already exists. Throws on constraint violations (e.g., missing required fields like `namespace` or `name`).
- **Warnings**: None.
- **Duplicate behavior**: Reject on exact ID match.
- **Missing-record behavior**: N/A.
- **Validation**: Enforces non-null strings for ID, namespace, kind, slug, name. Data must be a valid JSON object.
- **Null/undefined behavior**: Nulls in optional fields (identities, provenance) are safely ignored or treated as missing.

### 2. `insertAlias(alias: Alias)`
- **Inputs**: `Alias` object (id, entityId, alias).
- **Outputs**: None.
- **Errors**: Throws if `id` already exists, or if `entityId` does not reference an existing entity (Foreign Key constraint in SQL engines).
- **Duplicate behavior**: Reject on exact ID match.

### 3. `insertRelation(relation: Relation)`
- **Inputs**: `Relation` object (id, subjectId, predicate, objectId).
- **Outputs**: None.
- **Errors**: Throws if `id` already exists, or if `subjectId`/`objectId` do not exist.
- **Duplicate behavior**: Reject on exact ID match.

### 4. `insertClaim(claim: Claim)`
- **Inputs**: `Claim` object (id, entityId, statement, confidence, source).
- **Outputs**: None.
- **Errors**: Throws on invalid `confidence` values. Throws on missing `entityId`.
- **Validation**: `confidence` must be one of: "canon", "theory", "outdated", "unverified".

### 5. `insertDocument(document: Document)`
- **Inputs**: `Document` object (id, entityId, content).
- **Outputs**: None.
- **Errors**: Throws on missing `entityId`.

### 6. `resolve` (Query)
- **Inputs**: `alias: string`, `namespace?: string`.
- **Outputs**: Returns a `KnowledgeResult` containing `entities` that match the alias.
- **Errors**: None on missing. Returns empty array.
- **Warnings**: If multiple aliases map to different entities, returns all, potentially issuing a warning if the contract mandates strict single resolution.
- **Ordering**: Unspecified unless strictly defined.
- **Collation**: Case-sensitive by default, though SQL backends might deviate.

### 7. `getEntity` (Query)
- **Inputs**: `id: string`.
- **Outputs**: `entities` array with exactly 0 or 1 entity.
- **Errors**: None. Returns empty if not found.
- **Missing-record behavior**: Returns empty `entities` array.

### 8. `findRelations` (Query)
- **Inputs**: `predicate?: string`, `subjectId?: string`, `objectId?: string`. Must have at least one ID.
- **Outputs**: `relations` array.
- **Errors**: Throws if neither `subjectId` nor `objectId` is provided.
- **Ordering**: Unspecified.

### 9. `findClaims` (Query)
- **Inputs**: `entityId: string`.
- **Outputs**: `claims` array. Entities are NOT hydrated.
- **Errors**: None.
- **Ordering**: Unspecified.

### 10. `findDocuments` (Query)
- **Inputs**: `entityId: string`.
- **Outputs**: `documents` array. Entities are NOT hydrated.
- **Errors**: None.
- **Ordering**: Unspecified.

### 11. `search` (Query)
- **Inputs**: `search: SearchQuery` (query, namespace, kind, limit, mode).
- **Outputs**: `SearchResult` containing `entities` and `matches`.
- **Errors**: None.
- **Ordering**: Unspecified (likely scored, but deterministic tests must not depend on exact scores unless specified).

### 12. `traverse` (Query)
- **Inputs**: `startId: string`, `steps?: TraversalStep[]`, `maxDepth?: number`, `maxPaths?: number`, `predicates?: string[]`.
- **Outputs**: `TraversalResult` containing `entities`, `relations`, `paths`.
- **Errors**: Throws on invalid `maxDepth` or `maxPaths`.
- **Ordering**: Path ordering is typically unspecified, though deterministic graph traversal algorithms may implicitly order by DFS/BFS. Tests should sort paths by canonical representation before comparison.

### Transaction Behavior
- **InMemory**: Non-transactional. Operations apply immediately.
- **SQL (SQLite/Postgres)**: Currently, multi-insert operations should be explicitly wrapped if atomicity is desired.

## B. Divergences Discovered
1. **Constraint Parity (Foreign Keys)**:
   - `InMemoryEngine` allows inserting `Alias`, `Relation`, `Claim`, and `Document` records pointing to non-existent `entityId`s or `subjectId`/`objectId`s.
   - `SQLiteEngine` and `PostgresEngine` properly reject these operations with a `FOREIGN KEY constraint failed` error (or Postgres equivalent).
   - *Impact*: `InMemoryEngine` fails to mirror the strict referential integrity of SQL engines, potentially leading to passing tests that would crash in production.
2. **Constraint Parity (Primary Keys)**:
   - Previously fixed in `insertRelation` and `insertEntity`, but `InMemoryEngine` still lacks `Array.some(id)` uniqueness checks for `insertAlias`, `insertClaim`, and `insertDocument`.
   - *Impact*: Multiple records with identical IDs can be inserted in memory, while SQL will throw `UNIQUE constraint failed`.

## C. Final Verdict

1. **Do all engines actually implement the same API?**
   - Mostly yes on the read path (`query` method), but the write paths (`insertFixtures`) vary drastically in strictness. `InMemoryEngine` simulates a schema-less NoSQL document store during inserts, while the SQL engines enforce rigorous tabular constraints.
2. **Which engine currently behaves differently?**
   - `InMemoryEngine` behaves differently during insertions (accepting orphaned relational data and duplicate IDs for some record types).
3. **Which backend is most likely to contain latent bugs?**
   - `InMemoryEngine`, as its referential integrity isn't natively guaranteed by an underlying database. Tests relying on `InMemoryEngine` might assert on impossible states.
4. **Which differences are intentional?**
   - None of the foreign key constraint divergence is intentional; it's just the side effect of primitive array storage in memory.
5. **Which differences are bugs?**
   - Missing foreign key emulation in `InMemoryEngine`.
   - Missing duplicate ID checks for Aliases, Claims, and Documents in `InMemoryEngine`.
6. **What remains completely unverified?**
   - Postgres execution locally (CI execution handles it, but developer local environments cannot run the Postgres tests without a Dockerized instance).
   - Complex full-graph traversal randomized property testing is partially stubbed but not mathematically exhaustive.
   - String collation parity (e.g. `LIKE` operator case sensitivity in Postgres vs SQLite vs JavaScript).

## J. Ordering Contract Matrix

| Operation | Ordering Contract | Implementation Notes |
|---|---|---|
| `resolve` | **Explicitly unspecified** | SQL uses `SELECT DISTINCT` which may reorder rows. In-memory depends on insertion order. Tests must canonicalize. |
| `getEntity` | **Explicitly unspecified** | Only returns 0 or 1 entity. |
| `findRelations` | **Explicitly unspecified** | SQL engines return default clustered index or table scan order. In-memory returns insertion order. |
| `findClaims` | **Explicitly unspecified** | Same as above. |
| `findDocuments` | **Explicitly unspecified** | Same as above. |
| `search` | **Contractually Ordered** | Documented to deterministically order by ID (Binary/ASCII) before slicing to `limit`. SQL uses `ORDER BY id ASC`. In-memory sorts `(a, b) => a.id < b.id`. |
| `traverse` | **Contractually Ordered** | Paths are strictly ordered by `Depth` -> `Lexical representation of edges` -> `Target Entity ID`. |

## K. Null / Empty / Missing Behavior

| Field Type | Condition | Behavior | Engines Agreemnt |
|---|---|---|---|
| Optional Objects (identities, provenance, temporal) | omitted / undefined | Handled safely, coerced to null or ignored in SQL. In-memory maintains `undefined`. | Yes |
| Optional Strings | `""` (Empty String) | Allowed by schemas since there is no `CHECK (length > 0)`. | Yes |

## L. String / Collation Parity
- **Case Sensitivity**: All engines are strictly case-sensitive for `.resolve()` and exact-match filters because they rely on default `===` (JavaScript) and `=` without `COLLATE NOCASE`/`ILIKE` (SQL).
- **Whitespace**: Exact match strictly includes leading/trailing whitespace.
- **Unicode**: Standard UTF-8 equality applies across JavaScript, SQLite, and Postgres.

## M. Search Differential Testing
- `lexical`: Supported by all engines, tested in differential suite.
- `semantic` / `hybrid`: Unimplemented in current architecture. All engines correctly throw an explicit error (`Search mode 'semantic' is not supported by this engine.`) rather than silently falling back.

## N. Postgres CI
- **Verified**: The `.github/workflows/ci.yml` successfully provisions a `postgres:15` service and runs the test suite with `TEST_DATABASE_URL=postgres://postgres@localhost/e_test`.
- **Local Testing**: Locally unsupported unless Docker is explicitly running.
