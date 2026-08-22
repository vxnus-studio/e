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
