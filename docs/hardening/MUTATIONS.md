# E Core Mutation Model Specification

This document details the mutation primitives, foreign key cascading behavior, and data dependency rules.

---

## 1. Mutation Primitives & Foreign Key Rules

| Primitive | Target Table / Map | Foreign Key Invariants | Delete Cascade Behavior |
|---|---|---|---|
| `insertEntity(e)` | `e_entities` | Primary ID uniqueness | Root node deletion cascades to aliases, relations, claims, documents |
| `insertAlias(a)` | `e_aliases` | `entityId` must reference existing `Entity` | Cascades on parent Entity deletion |
| `insertRelation(r)` | `e_relations` | `subjectId` and `objectId` must exist | Cascades on subject or object Entity deletion |
| `insertClaim(c)` | `e_claims` | `entityId` must reference existing `Entity` | Cascades on parent Entity deletion |
| `insertDocument(d)` | `e_documents` | `entityId` must reference existing `Entity` | Cascades on parent Entity deletion |

---

## 2. Ingestion Ordering Rules
When inserting related data graphs, callers MUST supply records in dependency topological order:
1. `Entity` records must be inserted prior to referencing `Alias`, `Claim`, `Document`, or `Relation` records.
2. Both `subjectId` and `objectId` entities must be inserted prior to `Relation` creation.

---

## 3. Atomic Batch Ingestion (`EBatchMutator`)

All three backends implement `EBatchMutator`:
```typescript
export interface EBatchMutator {
  ingestBatch(dataset: BatchDataset): Promise<BatchIngestResult>;
}
```

### 3.1 All-or-Nothing Transaction Semantics
- **PostgreSQL (`PostgresEngine`)**:
  - Connects a dedicated client from the connection pool.
  - Issues `BEGIN`, iterates over entities, aliases, relations, claims, and documents.
  - On any failure (foreign key constraint, uniqueness violation, syntax error), executes `ROLLBACK`, translates error to canonical `ConstraintError` / `QueryError`, and guarantees zero partial records remain committed.
  - On success, issues `COMMIT` and releases client back to the pool.
- **SQLite (`SqliteEngine`)**:
  - Wraps batch ingestion in `this.db.transaction(() => { ... })()`.
  - On any failure, better-sqlite3 automatically aborts and rolls back the transaction.
- **InMemory (`InMemoryEngine`)**:
  - Snapshots maps and arrays prior to mutation.
  - On error, restores pre-transaction snapshot cleanly.

### 3.2 Batch Bound and Retry Contract

- A batch is limited to `100,000` total records across entities, aliases, relations, claims, and documents. Oversized batches fail validation before row-level validation or storage work.
- `ingestBatch` is atomic but not idempotent: replaying a successfully committed batch with the same IDs fails with `ConstraintError` and does not merge or update existing records.
- E does not automatically retry batches. Callers may retry only after determining whether the prior operation committed; retrying after an ambiguous connection failure can produce duplicate-key failures.
- Batch ordering is deterministic: entities, aliases, relations, claims, then documents, with each array processed in caller order.
