# E Core Transaction & Mutation Safety Specification

This document establishes the mutation atomicity boundaries, connection pooling invariants, and transaction design considerations for `@vxnus/e`, `@vxnus/e-sqlite`, and `@vxnus/e-postgres`.

---

## 1. Mutation & Atomicity Contract

### 1.1 Single-Operation Atomicity
All individual public mutation primitives defined in `EFixtureMutator` (`insertEntity`, `insertAlias`, `insertRelation`, `insertClaim`, `insertDocument`) are strictly atomic operations:
- If a constraint is violated (e.g. duplicate primary key, foreign key failure, check constraint violation), the mutation fails and throws [`ConstraintError`](file:///home/zagin/Projects/vxnuslabs/architecture/e/packages/core/src/errors.ts#L1-L7).
- No partial record is created.

### 1.2 Multi-Item Ingestion & Future Bulk Primitives
Currently, `EFixtureMutator` executes mutations sequentially. Individual operations are autocommitted at the database adapter level.
- **Contract Boundary**: High-volume atomic multi-table batch loading should be designed as a dedicated batch ingestion primitive prior to large-scale data imports, rather than exposing backend-specific connection tokens through the query contract.

---

## 2. PostgreSQL Connection Pool Lifecycle Invariants

1. **Connection Safety**: PostgreSQL pool queries utilize single parameterized statements through `pool.query()`, ensuring automatic return of client connections to the pool upon completion or rejection.
2. **Leak Prevention**: Errors thrown during insertion or querying release the allocated connection immediately without exhausting `pool.totalCount`; batch clients are released in `finally`.
3. **Acquisition failures**: A failure before a batch client is acquired is translated to `StorageError`; rollback is attempted only after acquisition succeeds.
4. **Shutdown**: `PostgresEngine.close()` is idempotent. Operations submitted after shutdown receive `StorageError(code=ENGINE_CLOSED)`.
5. **Retry policy**: E does not automatically retry transactions or mutations. Batch replay is caller-managed and is not idempotent.
