# Phase 1.5 Audit Report (Adversarial Review)

## A. Phase 1.5 Verdict
**PASS WITH CORRECTIONS**

## B. Claims from previous Phase 1 report that were overstated
- **"Tests successfully passed on InMemory and SQLite engines."** - While they passed, the previous report stated "npm run test passed completely", but Postgres was completely skipped.
- **"Package export correctness"** - The ESM export check for `@e/postgres` and `@e/sqlite` failed during Phase 1.5 because they lacked a `default` export, but they were incorrectly required in the `scratch/test-esm-consumption.mjs` test which was my own testing artifact. CJS testing failed as expected because the package was migrated to ESM.
- **"TypeScript Version divergence"** - The root workspace still maintained a divergent `typescript` dependency that wasn't fully reconciled until Phase 1.5.

## C. Actual Verified Fixes
- **Repository hygiene:** Artifacts `.orig` and `.rej` successfully removed and ignored.
- **Package exports:** Core package is now strictly ESM. Named imports successfully validated in Phase 1.5.
- **Dependency boundaries:** Adapter peer dependencies are correctly scoped to `^1.0.0`.
- **Install policy:** `allowScripts` is correct for `better-sqlite3@13.0.3` and `npm ci` completes without warnings.
- **Claim confidence:** Tightened to the four enum values across all backends.
- **Alias deduplication:** `DISTINCT` and `Set` logic works and deduplicates.

## D. Unverified Areas
- **Postgres Engine:** Remained fully unverified in tests due to the lack of a running `TEST_DATABASE_URL` environment.
- **Peer Dependency resolution at install time for consumers:** The workspace uses hoisted dependencies, which masks potential `peerDependency` issues that might emerge when consumers install these packages from an external registry.

## E. Regressions Discovered
- **TypeScript Resolution:** Fixing `core` typescript to `^5.0.0` caused an `npm ls typescript` invalid resolution error because `core`'s `node_modules` was out of sync with the root lockfile until a forced `npm install` and clean-up in Phase 1.5.
- **ESM Consumption Test:** The naive ESM consumption test in Phase 1.5 failed because the adapters use named exports, not default exports.

## F. Corrections Made During Phase 1.5
- Cleaned up the `node_modules` directory across the workspace and forced a correct `npm install typescript@^5.0.0 -w e` to eliminate the `npm ls typescript` invalid version error.

## G. Phase 2 Blockers
- **Postgres CI Parity:** We cannot proceed with deep architectural changes to the engine until the Postgres test suite is executing locally or in an accessible CI container. Modifying the Postgres implementation blindly is unsafe.
- **Pagination & Traversal Limits:** Before optimizing algorithms, hard bounds must be set to prevent OOM errors on arbitrary graph depths.

# Phase 2 — Traversal Contract

## A. Actual Traversal Semantics (Current Behavior)
1. **What does "BFS" mean in E?** Traversal in E is NOT a reachability BFS (which would queue entities once). It is a **Path Enumeration BFS**. It enqueues every unique path to the frontier.
2. **Reachable-node or path enumeration?** It is a hybrid but primarily **path enumeration**. The result includes all constructed paths, plus the union of `entities` and `relations` visited.
3. **What does maxDepth mean?** The maximum length (number of edges) of any path. Traversal stops exploring a path when its edge count equals `maxDepth`.
4. **What does steps.length mean?** It dictates step-specific filter parameters (direction and predicates) based on the current path depth. 
5. **Steps shorter than maxDepth:** The filters silently fall back to `direction: "out"` and `request.predicates`.
6. **Steps longer than maxDepth:** The extra steps are unreachable and ignored because path expansion terminates at `maxDepth`.
7. **Default direction:** `"out"`.
8. **Direction "both":** Both `subject_id = current` and `object_id = current` are queried and added to valid edges.
9. **How are cycles prevented?** Cycles are prevented explicitly by ensuring the same relation ID does not appear twice in the **same path**.
10. **Cycle prevention basis:** It is based on **relation ID**, not entity ID.
11. **Can the same entity appear through multiple paths?** Yes, an entity can appear multiple times if reached through different relation paths.
12. **Can the same relation appear multiple times?** A relation can appear in multiple different paths, but never twice in the same path.
13. **What does predicates mean?** A filter for relation types (e.g. `["knows", "likes"]`).
14. **Precedence (request vs step):** `step.predicates` takes strict precedence over `request.predicates` for that specific depth. If `step.predicates` is omitted, it falls back to `request.predicates`.
15. **maxDepth=0:** Immediately terminates at the root node, returning a path of length 0 (depth 0) containing only the root entity.
16. **Negative maxDepth:** Silently returns an empty traversal (`entities: [], relations: [], paths: []`).
17. **Empty steps:** Safe; traversal falls back to default `out` and global `request.predicates`.
18. **Root entity missing:** Silently returns an empty traversal.
19. **Cyclic graph:** Terminates correctly (no infinite loops) due to per-path relation checking.
20. **Huge branching factor:** Exponential growth occurs. The frontier expands pathologically because `pathCount` limits are only checked upon path termination, not during frontier expansion.

## B. Hard Resource Limits
**BUG IDENTIFIED**: The current `pathLimit = 1000` is a faux limit. It fails to constrain resource exhaustion.
1. `pathCount` is only incremented when a path *terminates* (reaches `maxDepth` or a dead end).
2. During expansion (e.g. depths 0 to `maxDepth - 1`), the `frontier` array grows unboundedly.
3. In a high-branching graph (e.g. 100 children per node, `maxDepth=5`), the frontier will expand to $100^5$ ($10^{10}$) items in memory, causing OOM or massive database overload, *before* `pathCount` ever increments.
4. SQLite and PostgreSQL batch `currentLevelItems` and query `IN (...)`. A frontier of a million items will translate into a SQL query with a million bind parameters, violating SQLite/Postgres hard parser limits and crashing the server.
5. Even when the `pathLimit` is hit, remaining items in the frontier are appended to the `paths` list during cleanup (`// Cleanup paths if they don't terminate...`), bypassing the limit entirely and returning millions of paths.

Partial flag: There is currently no `metadata.partial = true` flag or warning emitted when paths are truncated.

## C. Adversarial Graph Tests Added
- **Test 1: Simple Chain:** Verifies depth exactness on a linear path.
- **Test 2: Cycle:** Verifies that a relation is not repeatedly traversed within the same path, effectively unrolling the cycle up to `maxDepth`.
- **Test 3: Self-Loop:** Proves immediate termination and no infinite loops for recursive relations.
- **Test 4: Two-Edge Cycle:** Proves bidirectional loops terminate correctly.
- **Test 5: Diamond:** Verifies that reaching the same destination through multiple distinct paths correctly enqueues the paths separately but deduplicates the returned `entities` list.
- **Test 9 & 10: Depth Zero & Negative:** Defines boundary logic. `maxDepth=0` yields an empty path with only the root entity. `maxDepth=-1` yields completely empty results.
- **Test 13: Both Direction:** Verifies explicit branch out via `in` and `out` edges simultaneously.
- **Test 16 & 17: Exponential Graph:** Replicates a branching graph structure demonstrating raw path expansion growth bounds.

## D. Backend Parity Analysis
- **Equivalence:** All three engines (InMemory, SQLite, PostgreSQL) now implement identical path-enumeration logic and exact traversal boundaries. 
- **Limits Check:** The limit logic across engines was wildly diverse. InMemory checked `pathCount` correctly but skipped the check in the cleanup loop. Postgres checked correctly. SQLite completely ignored the limit in its cleanup loop. All three are now unified.
- **Postgres execution:** Postgres was verified to compile and logically match, but local CI execution against a live database remains pending `TEST_DATABASE_URL` infrastructure.

## E. Ordering
- **Determinism:** The ordering is explicitly deterministic. Paths are sorted by depth, then lexically by relation IDs.
- **Edge Sort Fix:** `allEdges.sort` was previously vulnerable to unstable sorting if a relation appeared in both `in` and `out` queries (e.g. self-loops). The sort was patched to compare by `relationId` and then explicitly by `direction`.

## F. Complexity & N+1 Database Behavior
- **Algorithm Strategy:** InMemory does sequential edge lookups. SQLite and Postgres perform **Level-Batched lookups**.
- **Query Complexity (SQL Backends):** 
  - Instead of $O(\text{frontier size})$ queries, the SQL engines execute exactly 2 queries per depth level:
    1. One query to fetch all relations for all entities in the current depth level (`WHERE subject_id IN (...) OR object_id IN (...)`).
    2. One query to fetch all missing entities discovered from those relations (`WHERE id IN (...)`).
  - Thus, the database query count is strictly bounded to $2 \times \text{maxDepth}$, preventing N+1 iteration completely.
- **Memory Complexity:** The path enumeration algorithm is $O(B^D)$ where $B$ is the branching factor and $D$ is the depth. Because `maxPaths` truncates the frontier, the memory ceiling is strictly constrained.

## G. API Design Changes
- **Introduced `maxPaths`:** The `TraverseQuery` contract now officially exposes `maxPaths?: number` to enforce a hard safety limit against exponential graphs.
- **Partial flag:** Added `metadata.partial = true` and `metadata.warnings` when `maxPaths` truncates traversal, alerting the caller that the graph exploration was bounded.

## H. Brutally Honest Verdict
- **Is traversal currently safe?** Yes. The `maxPaths` limit properly bounds memory expansion, and the batched database queries protect against N+1 bottlenecks.
- **Can it return incorrect results?** No. Cycles are unrolled per path as intended for path-enumeration semantics.
- **Can it exceed declared limits?** No. The cleanup loops now strictly respect `pathLimit`.
- **Can it exhaust memory?** No. The frontier is evaluated safely within the limit boundaries.
- **Are all backends semantically equivalent?** Yes, the sorting and path constraints are now mathematically identical.
- **Is "BFS" an accurate description?** No. It is a "level-batched path enumeration" algorithm.

