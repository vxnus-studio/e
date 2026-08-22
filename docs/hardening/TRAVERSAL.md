# E Core Traversal Contract & Algorithm Specification

This document defines the formal traversal execution model, boundary rules, cycle prevention, and resource limits for `@vxnus/e`, `@vxnus/e-sqlite`, and `@vxnus/e-postgres`.

---

## 1. Traversal Data Model & Semantics

### 1.1 Depth Semantics
- **Depth 0**: The starting entity alone: `paths: [{ startId, endId: startId, edges: [], depth: 0 }]`.
- **Depth $k$**: A sequence of $k$ directed edge steps connected end-to-end starting at `startId`.
- **`maxDepth` Range**: Integer between $0$ and $100$ (default $5$). Any out-of-range value throws `QueryError`.

### 1.2 Path Identity & Visited Rules
- **Path-Local Cycle Prevention**: A path cannot reuse the same `relationId` more than once (`current.pathEdges.some(pe => pe.relationId === r.id)`).
- **Converging Paths Preservation**: Multiple distinct paths arriving at the same entity (e.g. Diamond graphs: $A \to B \to D$ and $A \to C \to D$) are **both valid and preserved**. No global node-visited suppression is applied to paths.
- **Self-Relations**: Directed self-edges ($A \to A$) produce a valid depth-1 path and terminate safely at depth 1 without infinite recursion.

---

## 2. Resource Bounding & Intermediate Frontier Safety

### 2.1 Hard Safety Limits & Intermediate Frontier Safety
To prevent unbounded memory growth on pathological high-fan-out graphs ($A \to B_{1..10000}$), intermediate candidate generation, edge expansion, entity hydration, and path accumulation are bounded by hard, unbreachable safety limits:
- **`maxDepth`**: Hard ceiling on path edge length. Observable paths never have `depth > maxDepth`. Capped at `MAX_SAFE_DEPTH = 100` (default `5`).
- **`maxPaths`**: Hard ceiling on returned paths. Observable paths never exceed `maxPaths`. Capped at `MAX_SAFE_PATHS = 100,000` (default `1,000`).
- **`maxRelationsExpanded`**: Hard limit on total relation edges expanded and returned. Observable relations never exceed `maxRelationsExpanded` (default `100,000`).
- **`maxEntitiesHydrated`**: Hard limit on total entity records hydrated and returned. Observable entities never exceed `maxEntitiesHydrated` (default `50,000`).

Database fetch queries in `SqliteEngine` and `PostgresEngine` bound intermediate edge fetching to the remaining expansion budget (`remainingRelationBudget + 1`), preventing driver materialization of massive edge sets on high-degree nodes. Rows fetched beyond remaining budgets are strictly excluded from returned entities, visited relations, path expansion, and result counters.

The remaining relation budget is allocated deterministically across the entities in the current frontier (`floor(remainingBudget / frontierEntityCount)`, with the remainder assigned to the earliest frontier entities). SQL adapters issue bounded per-frontier-entity fetches rather than one global `LIMIT`, so a high-degree entity cannot consume the entire fetch budget and starve later frontier entities. InMemory uses the same round-robin edge expansion order.

If a bounded per-entity fetch returns exactly its allocation, traversal reports `partial: true` because additional matching rows may have been suppressed by that allocation. This conservative signal avoids claiming completeness when the bounded query cannot prove that no rows remain.

```typescript
if (totalRelationsExpanded >= maxRelationsExpanded) {
  truncationOccurred = true;
  truncationReasons.push("maxRelationsExpanded limit reached");
  break;
}
```

### 2.2 `maxPaths` & Partial Semantics
- **`maxPaths = 0`**: Returns `{ entities: [], relations: [], paths: [] }`.
- **`maxPaths` Range**: Integer between $0$ and $100,000$ (default $1,000$).
- **`metadata.partial` Invariant**: Set to `true` if and only if candidate expansion, relation expansion, entity hydration, or path collection was truncated due to exceeding resource budgets. Exhausting depth within `maxDepth` on a finite graph does *not* set `partial: true`.
- **Warnings**: `metadata.warnings` includes informative reason strings explaining which ceiling caused the truncation (e.g. `Traversal truncated: maxRelationsExpanded limit reached`, `Traversal reached maxPaths limit`).

---

## 3. Deterministic Path Ordering

All engines apply an identical canonical sort order to discovered paths:
1. `depth ASC` (shortest paths first).
2. Lexicographical comparison of comma-joined `relationId` sequence.
3. Lexicographical comparison of `endId`.

---

## 4. Query Batching across Backends

- **`InMemoryEngine`**: Synchronous in-memory BFS expansion with bounded edge and entity evaluation.
- **`SqliteEngine`**: Level-by-level batched `SELECT ... WHERE subject_id/object_id IN (...)` (chunked at 500 IDs with budget-aware limits).
- **`PostgresEngine`**: Level-by-level batched `SELECT ... WHERE subject_id/object_id = ANY($1)` with `ORDER BY id ASC LIMIT $budget`.
