# Traversal Scale & Performance Analysis (Phase 4)

This document tracks graph scaling behavior, intermediate complexity, and query counts.

---

## 1. Complexity & Memory Bounds

| Dimension | Bound | Guarantees |
|---|---|---|
| **Max Depth** | $\le 100$ | Hard safety limit. Prevents stack overflow. |
| **Max Paths** | $\le 100,000$ | Default 1,000. Prevents infinite frontier explosion. |
| **Frontier Memory** | $O(\text{maxPaths})$ | Intermediate level expansion is bounded by `maxPaths`. |
| **Visited Entities** | $O(\text{visited entities})$ | Global Set/Map prevents redundant DB entity lookups. |

---

## 2. DB Round-Trip Patterns

- **PostgreSQL**: 1-2 SQL queries per BFS level depth step (batched array queries via `= ANY($1)`), avoiding N+1 round-trips.
- **SQLite**: Batched queries chunked in batches of 500 parameters per BFS level.
