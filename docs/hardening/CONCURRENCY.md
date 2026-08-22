# E Runtime Concurrency & Connection Pool Specification

This document details concurrent reader-writer guarantees, connection pool safety, and race handling across `@vxnus/e`, `@vxnus/e-sqlite`, and `@vxnus/e-postgres`.

---

## 1. Concurrency Model & Guarantees

| Scenario | InMemory | SQLite | PostgreSQL | Invariant Status |
|---|---|---|---|---|
| **Simultaneous Reads** | Non-blocking | Non-blocking | Non-blocking | **SAFE** |
| **Concurrent Reads & Writes** | Synchronous tick | Single-writer serialization | MVCC Non-blocking reads | **SAFE** |
| **Duplicate PK Insert Race** | Rejects with `ConstraintError` | Rejects with `ConstraintError` | Rejects with `ConstraintError` | **SAFE (Atomic DB constraint)** |
| **Connection Pool Cleanup** | N/A | Single DB handle | Acquired and released automatically | **SAFE (Leak-free)** |

## 2. PostgreSQL lifecycle contract

- `PostgresEngine.close()` is idempotent and shares one shutdown promise when called concurrently.
- Queries and mutations after close fail with `StorageError` using code `ENGINE_CLOSED`.
- `pool.query()` operations return clients to the pool through node-postgres; batch transactions release their dedicated client in `finally`, including acquisition and rollback failures.
- E does not automatically retry operations. Callers must decide whether an ambiguous operation is safe to retry.

Live PostgreSQL pool exhaustion, connection-acquisition failure, timeout, isolation, and serialization tests remain required before production readiness.
