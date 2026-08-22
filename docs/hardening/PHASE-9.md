# Phase 9 Hardening: Traversal Safety & Atomic Batch Ingestion

## Summary of Completed Work

Phase 9 resolves the two critical P0 blockers identified during independent verification:
1. **P0-1: Traversal Resource Safety**: Intermediate candidate edge expansion and entity hydration are strictly bounded across InMemory, SQLite, and PostgreSQL. Database fetch queries bound intermediate edge retrieval directly to prevent high fan-out driver materialization.
2. **P0-2: Atomic Multi-Record Ingestion**: Designed and implemented the backend-neutral `EBatchMutator` / `ingestBatch` interface with guaranteed all-or-nothing rollback on any mid-batch failure across InMemory, SQLite, and PostgreSQL.

---

## 1. P0-1: Traversal Resource Safety Remediation

### Problem
Previously, traversal bounded final collected paths (`paths.length < maxPaths`), but intermediate frontier generation fetched and materialized all outgoing/incoming relations and hydrated all entity objects before checking path bounds. On graphs with massive degree (e.g. 100k edges), this caused unbounded memory consumption and latency.

### Resolution
- Added traversal resource parameters: `maxRelationsExpanded` (default 100,000) and `maxEntitiesHydrated` (default 50,000) to `QueryRequest`.
- **Database Query Safety**:
  - `PostgresEngine`: Bounded level SQL queries using `LIMIT (remainingRelationBudget + 1)`.
  - `SqliteEngine`: Bounded batch execution queries against remaining expansion budget.
  - `InMemoryEngine`: Evaluates expansion budgets step-by-step during edge iteration.
- **Entity Hydration Bounding**: Visited entity hydration is capped at `maxEntitiesHydrated`.
- **Truncation Semantics**: When any resource budget (`maxPaths`, `maxRelationsExpanded`, `maxEntitiesHydrated`) is hit, traversal stops cleanly, marks `metadata.partial = true`, emits explicit warnings in `metadata.warnings`, and returns all discovered valid paths.
- **Deterministic Sorting**: Retained canonical multi-engine sort ordering.

---

## 2. P0-2: Atomic Multi-Record Ingestion Remediation

### Problem
Previously, mutations were only exposed as single-record fixture mutators (`insertEntity`, `insertAlias`, etc.) without atomic multi-record transaction boundaries. If a dataset load failed midway (e.g. after inserting 50 entities when the 51st had a broken foreign key), earlier records remained permanently committed.

### Resolution
- Defined `BatchDataset`, `BatchIngestResult`, and `EBatchMutator` in `@vxnus/e`:
  ```typescript
  export interface BatchDataset {
    entities?: Entity[];
    aliases?: Alias[];
    relations?: Relation[];
    claims?: Claim[];
    documents?: Document[];
  }

  export interface EBatchMutator {
    ingestBatch(dataset: BatchDataset): Promise<BatchIngestResult>;
  }
  ```
- **PostgreSQL (`PostgresEngine`)**:
  - Checks out a dedicated client from the pool.
  - Wraps insertions in `BEGIN ... COMMIT`.
  - On any error, executes `ROLLBACK`, translates Postgres error codes to canonical `ConstraintError` / `QueryError`, and releases the client in a `finally` block.
- **SQLite (`SqliteEngine`)**:
  - Executes batch insertions inside `this.db.transaction(() => { ... })()`.
  - On any failure, SQLite rolls back the transaction completely.
- **InMemory (`InMemoryEngine`)**:
  - Snapshots maps and arrays before executing insertions.
  - Restores the snapshot on any thrown error, ensuring zero leaked partial state.

---

## 3. Test Coverage

- `packages/differential/test/traversal_adversarial.test.ts`:
  - Added tests explicitly verifying `maxRelationsExpanded` and `maxEntitiesHydrated` stopping criteria and truncation warnings on dense fan-out graphs.
- `packages/differential/test/mutation_transaction.test.ts`:
  - Added tests verifying all-or-nothing rollback on mid-batch constraint failure (zero records remain).
  - Added tests verifying successful atomic batch insertion across all five domain types (`entities`, `aliases`, `relations`, `claims`, `documents`).
  - Added empty batch test.

---

## 4. Verification Results
- `npm run build`: Exit 0 (all TypeScript workspaces compiled).
- `npm test`: 66/66 tests passing across all packages (`@vxnus/e`, `@vxnus/e-postgres`, `@vxnus/e-sqlite`, `@vxnus/differential`).
