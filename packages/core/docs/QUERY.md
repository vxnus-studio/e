# Query Contract

E requires a standardized query interface so consumers like Siduri can retrieve knowledge identically regardless of transport or backend engine (InMemory, SQLite, Postgres).

## The Interface

```typescript
interface EQueryEngine {
  query(request: QueryRequest): Promise<KnowledgeResult>;
}
```

## Request Intents

The `QueryRequest` is a discriminated union of query intents. Below is the authoritative contract for every query type.

### 1. `resolve`
Finds entities by alias.
- **Request Shape:** `{ type: "resolve"; alias: string; namespace?: string }`
- **Required Fields:** `alias`
- **Optional Fields:** `namespace`
- **Defaults:** If `namespace` is omitted, resolves across all namespaces.
- **Result Shape:** Returns all matching `Entity` records in `entities`. Returns empty if not found.
- **Ordering:** Non-deterministic depending on the backend, though typically insertion order.
- **Backend Parity:** Fully supported by all engines.

### 2. `getEntity`
Fetches a single entity by its exact ID.
- **Request Shape:** `{ type: "getEntity"; id: string }`
- **Required Fields:** `id`
- **Optional Fields:** None.
- **Result Shape:** Returns the `Entity` in `entities`.
- **Errors:** Emits a warning in `metadata.warnings` if the entity is not found (e.g., `Entity not found: {id}`). Returns empty lists.
- **Backend Parity:** Fully supported by all engines.

### 3. `findRelations`
Finds directed graph edges. Must provide at least one of `subjectId` or `objectId`.
- **Request Shape:** `{ type: "findRelations"; predicate?: string } & ({ subjectId: string; objectId?: string } | { subjectId?: string; objectId: string })`
- **Required Fields:** `subjectId` OR `objectId` (or both).
- **Optional Fields:** `predicate`
- **Defaults:** If `predicate` is omitted, returns all matching relations.
- **Result Shape:** Returns the matching `Relation[]` in `relations`. Automatically hydrates the subjects and objects into `entities`.
- **Errors:** Throws `Error("Must provide at least subjectId or objectId")` if both are missing.
- **Backend Parity:** Fully supported by all engines.

### 4. `findClaims`
Fetches subjective or qualitative facts asserted about an entity.
- **Request Shape:** `{ type: "findClaims"; entityId: string }`
- **Required Fields:** `entityId`
- **Result Shape:** Returns `Claim[]` in `claims`. *Note: Does NOT hydrate the target entity.*
- **Backend Parity:** Fully supported by all engines.

### 5. `findDocuments`
Fetches long-form text documents attached to an entity.
- **Request Shape:** `{ type: "findDocuments"; entityId: string }`
- **Required Fields:** `entityId`
- **Result Shape:** Returns `Document[]` in `documents`. *Note: Does NOT hydrate the target entity.*
- **Backend Parity:** Fully supported by all engines.

### 6. `search`
Searches entities by a substring match against `name` or `slug`.
- **Request Shape:** `{ type: "search"; query: string; namespace?: string; limit?: number }`
- **Required Fields:** `query`
- **Optional Fields:** `namespace`, `limit`
- **Defaults:** Unbounded search if `limit` is undefined.
- **Limits:** If `limit <= 0`, immediately returns an empty result `[]`. If `limit > 0`, returns up to that many entities.
- **Ordering:** Deterministically ordered by `id` ascending across all engines.
- **Backend Parity:** All engines support ASCII case-insensitive search. (Full Unicode case-insensitivity depends on the underlying database engine collation).

### 7. `traverse`
Performs a directed Breadth-First Search (BFS) graph traversal starting from an entity ID.
- **Request Shape:** `{ type: "traverse"; startId: string; maxDepth?: number; predicates?: string[] }`
- **Required Fields:** `startId`
- **Optional Fields:** `maxDepth`, `predicates`
- **Defaults:** `maxDepth` defaults to `5` if undefined. If `predicates` is omitted or empty, all edges are followed.
- **Limits:** 
  - `maxDepth = 0` returns only the start entity.
  - `maxDepth < 0` returns an empty result `[]`.
- **Ordering & Cycles:** 
  - **Deterministic BFS:** At each depth layer, outgoing edges are sorted by `object_id` (ASCII/binary ASC).
  - **Deduplication:** Converging paths (e.g., `A->B, A->C, B->D, C->D`) will only yield node `D` once, at the earliest discovered depth layer.
  - **Cycles:** `A->B->C->A` terminates gracefully using a visited-node tracker.
- **Result Shape:** Returns all discovered nodes in `entities`.
- **Backend Parity:** Fully supported by all engines. Implemented using scalable, frontier-based depth layer queries (no N+1 node loop scaling issues).

---

## Result Contract

The engine returns a hydrated graph slice, not tabular rows.

```typescript
interface KnowledgeResult {
  entities: Entity[];
  relations: Relation[];
  claims: Claim[];
  documents: Document[];
  metadata: QueryMetadata; // Contains timeMs, warnings, partial flag
}
```

This ensures AI consumers have self-contained context packages.

For strict rules regarding what an engine *must* return (especially regarding hydration, unhandled requests, and missing entities), see [HYDRATION_AND_ERRORS.md](./HYDRATION_AND_ERRORS.md).
