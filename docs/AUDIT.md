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

