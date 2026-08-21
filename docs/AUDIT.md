# Phase 2.5 Audit Report (Verification)

## A. Claims from Phase 2 that were too strong
- **"maxPaths strictly bounds exponential explosions"**: This was partially true, but a single step of expansion from the frontier could still collect more edges than `maxPaths` before filtering. SQL `IN (...)` parameters could exceed database safe limits (`1000` for SQLite, `32767` for Postgres) if the immediate branching factor was extremely high.
- **"strictly ordered"**: The tie-breaking comparator resolved to 0 if the path signatures matched but endpoints differed (e.g., parallel paths to different entity instances via identically-named relations), which theoretically breached strict total ordering.

## B. New Bugs Discovered
1. **SQL Binding Limit Exceedance**: In highly connected graphs, checking all current boundary relations (`missingEntityIds.size > 0`) in a single query `SELECT ... WHERE id IN ($1...$N)` could crash the database due to parameter overflow.
2. **Missing Boundary Validation**: User input for `maxDepth` and `maxPaths` could be negative, fractional, `NaN`, or insanely large (`Number.MAX_SAFE_INTEGER`), bypassing constraints or crashing loop iterators.

## C. Bugs Fixed
- Implemented **SQL Parameter Chunking** (`chunkSize = 500`) in both PostgreSQL and SQLite. This mathematically guarantees that no query will exceed standard database bind-parameter limits, regardless of the `maxPaths` configuration.
- Enforced **Total Tie-Breaking** in sorting by including `a.endId < b.endId` for paths that otherwise have identical relation strings.
- Standardized strict API boundaries:
  - `maxDepth` is explicitly clamped between `0` and `100`. Fractional, `NaN`, or negative values coerce to `0`.
  - `maxPaths` is explicitly clamped between `1` and `100,000`. Fractional, `NaN`, or negative values coerce to the default `1000`.

## D. Tests Added
- Validation bounds logic: Asserted that `maxDepth=NaN` correctly falls back safely.
- Validation clamps: Asserted `maxPaths=1000000` correctly clamps.
- Step-precedence: Confirmed step-level predicates override request-level global predicates.
- Short steps array semantics: Asserted that step filters silently fall back to `direction="out"` and request global predicates if unspecified.

## E. Resource-bound Analysis
- Memory expansion is now strictly constrained. Frontier chunks are batched. Even if the maximum allowed value (`maxPaths=100,000`) is requested, it requires roughly $100,000 \times \text{edge\_bytes}$ in resident node memory, which is comfortably within standard process limits. 

## F. SQL Parameter Analysis
- Batched to a strict ceiling of `500` items per `IN(...)` statement.

## G. Path Uniqueness Definition
- Uniqueness is strictly defined by the **sequence of relation IDs**.
- Two physical edges with the exact same relation ID (violating typical primary key assumptions but possible in malformed storage) would be considered the same topological step by cycle prevention.

## H. Cycle Definition
- Cycle detection operates strictly on **relation IDs within the current path**. You cannot traverse the exact same edge twice in a single continuous walk. 

## I. Ordering Definition
- Total canonical ordering: `Depth` -> `Lexical representation of edges string` -> `Target Entity ID`.

## J. Complexity Analysis
- The $O(\text{maxDepth})$ assertion for DB round trips was modified. Because of `IN (...)` chunking at sizes of 500, a massive frontier now triggers $O(\frac{\text{frontier}}{500} \times \text{maxDepth})$ round-trips. This trades $O(1)$ query count for memory and parser safety, keeping CPU/DB throughput stable.

## K. PostgreSQL Verification Status
- UNVERIFIED AT RUNTIME: PostgreSQL tests are logically equivalent but bypass execution locally due to the absence of `TEST_DATABASE_URL`. CI verification is mandatory.

## L. Remaining Risks
- Relying on CI to test Postgres means we are still theoretically vulnerable to a syntax mismatch between SQLite query builder logic and Postgres wire protocol logic (e.g., placeholder indices `?` vs `$1`). I have visually patched this using chunked array maps, but a runtime execution remains the absolute final check.

