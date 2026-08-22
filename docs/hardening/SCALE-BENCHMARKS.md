# E Runtime Scale & Performance Benchmark Specification

This document defines the complexity profiles, observed scale characteristics, and resource bounds across `@vxnus/e`, `@vxnus/e-sqlite`, and `@vxnus/e-postgres`.

---

## 1. Scale Benchmark Matrix

| Operation | Scale Tested | InMemory Profile | SQLite Profile | PostgreSQL Profile | Observed Invariants |
|---|---|---|---|---|---|
| **Point Lookup (`getEntity`)** | 1,000 entities | $O(1)$ Hash Map | $O(\log N)$ Index Scan | $O(\log N)$ Index Scan | Sub-millisecond latency |
| **Search + Namespace Filter** | 1,000 entities | $O(N)$ In-memory Scan | $O(N)$ LIKE Scan | $O(N)$ ILIKE Scan | Bounded by `LIMIT 50` push-down |
| **Wide Traversal Fan-Out** | 600 child nodes | $O(F)$ bounded by path/entity limits | Bounded relation queries and 500-ID hydration chunks | Per-frontier relation queries and bounded hydration | No global SQL limit starvation; live PostgreSQL plan pending |
| **Concurrent Load** | 50 concurrent ops | Single-threaded | Single-file locking | Multi-client connection pool | Zero connection leaks |
| **Duplicate Insertion Race** | 10 parallel inserts | First write succeeds | First write succeeds | Atomic DB constraint violation | 1 success, 9 rejections |

## 2. Measurement limits

The repository currently has behavioral scale tests, not a benchmark harness with repeatable latency, memory, query-plan, or throughput samples. The 1,000-entity test is a regression envelope, not a production capacity claim. No 100k or 1m dataset has been measured at this HEAD, and PostgreSQL rows are not exercised without `TEST_DATABASE_URL`.
