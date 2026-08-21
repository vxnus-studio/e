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
- **Errors:** Returns empty lists if the entity is not found. It does not emit a warning or throw an error.
- **Backend Parity:** Fully supported by all engines.

### 3. `findRelations`
Finds directed graph edges. Must provide at least one of `subjectId` or `objectId`.
- **Request Shape:** `{ type: "findRelations"; predicate?: string } & ({ subjectId: string; objectId?: string } | { subjectId?: string; objectId: string })`
- **Required Fields:** `subjectId` OR `objectId` (or both).
- **Optional Fields:** `predicate`
- **Defaults:** If `predicate` is omitted, returns all matching relations.
- **Result Shape:** Returns the matching `Relation[]` in `relations`. Automatically hydrates the subjects and objects into `entities`.
- **Errors:** Throws `Error("Must provide at least subjectId or objectId")` if both are missing.
- **Ordering:** Intentionally unspecified.
- **Backend Parity:** Fully supported by all engines.

### 4. `findClaims`
Fetches subjective or qualitative facts asserted about an entity.
- **Request Shape:** `{ type: "findClaims"; entityId: string }`
- **Required Fields:** `entityId`
- **Result Shape:** Returns `Claim[]` in `claims`. *Note: Does NOT hydrate the target entity.*
- **Ordering:** Intentionally unspecified.
- **Backend Parity:** Fully supported by all engines.

### 5. `findDocuments`
Fetches long-form text documents attached to an entity.
- **Request Shape:** `{ type: "findDocuments"; entityId: string }`
- **Required Fields:** `entityId`
- **Result Shape:** Returns `Document[]` in `documents`. *Note: Does NOT hydrate the target entity.*
- **Ordering:** Intentionally unspecified.
- **Backend Parity:** Fully supported by all engines.

### 6. `search`
Searches entities by a substring match against `name` or `slug`.
- **Request Shape:** `{ type: "search"; search: { query: string; namespace?: string; kind?: string; limit?: number; mode?: string } }`
- **Required Fields:** `search.query`
- **Optional Fields:** `search.namespace`, `search.limit`, `search.kind`, `search.mode`
- **Limits:** Limit must be a non-negative integer. If `limit=0`, returns empty immediately. Limit is strictly clamped at `10000`. Exceeding this bound or invalid types throw `QueryError`.
- **Performance:** This is currently implemented via `LIKE '%query%'` (full table scans). This is not a production-scale inverted-index search engine.
- **Ordering:** Deterministically ordered by `id` ascending across all engines (UTF-16 code units in JS, UTF-8 in SQL).
- **Result Shape:** Returns a `SearchResult` object containing `entities` and `matches` in `search`.

### 7. `traverse`
Performs a directed Breadth-First Search (BFS) graph traversal starting from an entity ID.
- **Request Shape:** `{ type: "traverse"; startId: string; maxDepth?: number; steps?: TraversalStep[]; predicates?: string[] }`
- **Required Fields:** `startId`
- **Optional Fields:** `maxDepth`, `steps`, `predicates`
- **Defaults:** `maxDepth` defaults to `5` if undefined. If `steps` and `predicates` are omitted, all out edges are followed.
- **Result Shape:** Returns `traversal` containing `entities`, `relations`, and `paths`.

### 8. `getCapabilities`
Retrieves the supported feature set of the current backend.
- **Request Shape:** `{ type: "getCapabilities" }`
- **Result Shape:** Returns `capabilities: ProviderCapabilities`.

---

## Result Contract

The engine returns a hydrated graph slice, not tabular rows.

```typescript
interface KnowledgeResult {
  entities?: Entity[];
  relations?: Relation[];
  claims?: Claim[];
  documents?: Document[];
  traversal?: TraversalResult;
  search?: SearchResult;
  capabilities?: ProviderCapabilities;
  metadata: QueryMetadata; // Contains timeMs, warnings, partial flag
}
```

This ensures AI consumers have self-contained context packages.

For strict rules regarding what an engine *must* return (especially regarding hydration, unhandled requests, and missing entities), see [HYDRATION_AND_ERRORS.md](./HYDRATION_AND_ERRORS.md).
