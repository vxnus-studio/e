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

### 2.1 Intermediate Frontier Capping
To prevent unbounded memory growth on pathological high-fan-out graphs ($A \to B_{1..10000}$), intermediate candidate generation (`nextFrontier`) is bounded at the `maxPaths` safety limit ($O(\text{maxPaths})$ space bound):
```typescript
if (nextFrontier.length < pathLimit) {
  nextFrontier.push(candidate);
} else {
  truncationOccurred = true;
}
```

### 2.2 `maxPaths` & Partial Semantics
- **`maxPaths = 0`**: Returns `{ entities: [], relations: [], paths: [] }`.
- **`maxPaths` Range**: Integer between $0$ and $100,000$ (default $1,000$).
- **`metadata.partial` Invariant**: Set to `true` if and only if candidate expansion or path collection was truncated due to exceeding `maxPaths`. Exhausting depth within `maxDepth` on a finite graph does *not* set `partial: true`.

---

## 3. Deterministic Path Ordering

All engines apply an identical canonical sort order to discovered paths:
1. `depth ASC` (shortest paths first).
2. Lexicographical comparison of comma-joined `relationId` sequence.
3. Lexicographical comparison of `endId`.

---

## 4. Query Batching across Backends

- **`InMemoryEngine`**: Synchronous in-memory BFS expansion.
- **`SqliteEngine`**: Level-by-level batched `SELECT ... WHERE subject_id/object_id IN (...)` (chunked at 500 IDs).
- **`PostgresEngine`**: Level-by-level batched `SELECT ... WHERE subject_id/object_id = ANY($1)`.
