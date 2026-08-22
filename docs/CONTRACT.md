# Canonical API Contract

This document defines the strict, authoritative semantic contract for the `@vxnus/e` Knowledge Engine API. This contract dictates how all compliant backends (InMemory, SQLite, PostgreSQL, etc.) must behave. 

If an implementation deviates from this document, the implementation is incorrect.

## 1. Data Model Invariants

The core data structures have the following strictly enforced invariants across all backends:

### Entity
- **ID (`id`)**: Must be a globally unique, non-null string.
- **Required Fields**: `namespace`, `kind`, `slug`, `name` must be non-null strings.
- **Payload (`data`)**: Must be a valid JSON object.
- **Enforcement**: TypeScript types, Database Primary Keys (SQL), explicit `.has()` checks (InMemory).

### Alias
- **ID (`id`)**: Must be globally unique.
- **Foreign Key (`entityId`)**: Must reference an existing Entity ID. Deleting the entity must cascade delete the alias (SQL) or be modeled identically.
- **Enforcement**: Database `REFERENCES` constraints (SQL), explicit `.has(entityId)` (InMemory).

### Relation
- **ID (`id`)**: Must be globally unique.
- **Foreign Keys (`subjectId`, `objectId`)**: Must both reference existing Entity IDs. Cascade deletions apply.
- **Enforcement**: Database `REFERENCES` constraints (SQL), explicit checks (InMemory).

### Claim
- **ID (`id`)**: Must be globally unique.
- **Foreign Key (`entityId`)**: Must reference an existing Entity ID.
- **Enum (`confidence`)**: Must strictly be one of `"canon"`, `"theory"`, `"outdated"`, or `"unverified"`.
- **Enforcement**: Database `CHECK` (SQL), TS types and runtime checks (InMemory).

### Document
- **ID (`id`)**: Must be globally unique.
- **Foreign Key (`entityId`)**: Must reference an existing Entity ID.

## 2. Null, Empty, and Missing Semantics
- **Optional Fields** (`identities`, `provenance`, `temporal`): Can be omitted or `undefined` in request types. Backends may safely coerce `undefined` to `null` or ignore them without violating the contract.
- **Empty Strings**: `""` is a valid string for fields like `name` or `alias`.
- **Missing Records**: Queries for nonexistent IDs return empty result arrays, never `null` root objects.

## 3. String and Collation Semantics
- **Case Sensitivity**: Exact-match queries (like `resolve` and `getEntity`) are strictly **case-sensitive**. `A !== a`. 
- **Whitespace**: Exact matching strictly preserves and enforces leading/trailing whitespace.
- **Collation**: Standard Unicode (UTF-8) equality is assumed. Backends that default to case-insensitive collations (e.g., MySQL default) must be configured to be case-sensitive to comply.

## 4. Query Operation Contract

All queries accept a discriminated union `QueryRequest` and return a unified `KnowledgeResult`.

### 4.1. `resolve`
- **Input**: `alias: string`, `namespace?: string`.
- **Behavior**: Finds all entities that map to the given `alias`.
- **Matches**: Exact string match, case-sensitive.
- **Duplicate/Multiple Matches**: If multiple entities share the same alias, it returns all of them.
- **Ordering**: Explicitly Unspecified.

### 4.2. `getEntity`
- **Input**: `id: string`.
- **Behavior**: Returns the entity matching the exact ID.
- **Output Size**: Exactly 0 or 1 entity.
- **Ordering**: Explicitly Unspecified.

### 4.3. `findRelations`
- **Input**: Requires at least one of `subjectId` or `objectId`. Optionally `predicate` and `limit`.
- **Behavior**: Returns edges matching the provided criteria.
- **Ordering**: Relation ID ascending; hydrated entity ID ascending.
- **Result Bound**: `limit` defaults to `1000`, clamps to a maximum effective limit of `10000`, and `limit=0` returns no rows. Truncated results set `metadata.partial` and a warning.

### 4.4. `findClaims` & `findDocuments`
- **Input**: `entityId: string`, optionally `limit`.
- **Behavior**: Returns claims or documents associated with the entity. Does not hydrate the parent entity.
- **Ordering**: Claim/document ID ascending.
- **Result Bound**: `limit` defaults to `1000`, clamps to a maximum effective limit of `10000`, and `limit=0` returns no rows. Truncated results set `metadata.partial` and a warning.

### 4.5. `search`
- **Input**: `search: SearchQuery` (query, namespace?, kind?, limit?, mode?).
- **Modes**:
  - `lexical`: Supported. Performs a substring/`LIKE` match on entity `name` and `slug`.
  - `semantic`: Unsupported. Must explicitly throw an `Error("Search mode 'semantic' is not supported")`.
  - `hybrid`: Unsupported. Must throw.
- **Fields Searched**: Only `name` and `slug` are searched. `alias`, `kind`, `namespace`, and `data` are not searched (though `namespace` and `kind` act as exact-match `AND` filters).
- **Semantics**:
  - **Case-Sensitivity**: 
    - JavaScript (InMemory) and Postgres (`ILIKE`) do full Unicode case-folding.
    - SQLite (`LIKE`) performs ASCII-only case-folding (unless compiled with ICU). Users should not rely on SQLite for Unicode case-insensitive search.
  - **Empty Query (`""`)**: Returns all entities matching the filters, up to the limit.
  - **Whitespace Query (`"   "`)**: Returns only entities whose `name` or `slug` literally contain that whitespace.
  - **Wildcards**: `%` and `_` are escaped explicitly. A query for `%` matches the literal character `%`, not everything.
  - **Duplicates**: An entity can only appear once in the results, even if both its `name` and `slug` match.
- **Filters**: `namespace` and `kind` are strictly applied as `AND` filters.
- **Scores**: No score is provided. `matches` arrays will only specify `matchReason: "lexical"`.
- **Limits**: `limit` must be a non-negative integer. If `limit=0`, the query immediately returns empty. Maximum search limit is `10000`. Exceeding it clamps to `10000`. Invalid values (`< 0` or decimal/NaN) will throw a `QueryError`.
- **Truncation**: If more matches exist than the effective limit, results are truncated deterministically and `metadata.partial` is `true` with a warning.
- **Ordering**: **Contractually Ordered**. Implementations must sort by `id` ascending before slicing to `limit` to guarantee deterministic pagination. Note: JavaScript (InMemory) sorts by UTF-16 code units (`<`), whereas SQL engines sort by UTF-8 bytes (`COLLATE "C"` or `BINARY`). Ordering is guaranteed identically across backends for BMP characters, but diverges for characters outside the BMP (e.g., Emoji).
- **Scale**: Lexical substring matching is currently an O(N) scan in all backends. The result limit bounds materialization, but does not make arbitrary substring search index-backed or production-scale.

### 4.6. `traverse`
- **Input**: `startId: string`, `steps?: TraversalStep[]`, `maxDepth?: number`, `maxPaths?: number`, `predicates?: string[]`.
- **Path Enumeration**: Emits all distinct valid paths branching from the start entity up to `maxDepth` or `maxPaths`.
- **Cycle Handling**: A path may not traverse the exact same `relationId` twice.
- **Limits**: `maxDepth` strictly `[0, 100]`. `maxPaths` strictly `[0, 100000]`. Invalid values must throw. Zero values short-circuit execution.
- **Ordering**: **Contractually Ordered**. Paths are sorted deterministically by: `Depth` -> `Lexical representation of edges` -> `Target Entity ID`.

## 5. Temporal and Provenance Semantics
- **Temporal**: Supported fields (`observedAt`, `validFrom`, etc.) are currently inert metadata. The engine does not perform temporal filtering or interval intersections.
- **Provenance**: Opaque JSON metadata. The engine does not evaluate confidence or derive facts from provenance during queries.

## 6. Error Model
- **Generic Errors**: Currently, the API emits generic JavaScript `Error` objects for unsupported modes or constraint failures.
- **Constraint Errors**: Throw when attempting to insert orphaned relations/aliases or duplicate IDs.
- **Limit Errors**: Throw on invalid traversal limits (e.g. negative depth).

## 7. Result Model (`KnowledgeResult`)
- **Structure**: Always returns arrays for queried entities, relations, claims, documents (unless omitted by query type). Never returns `undefined` for a queried collection field; defaults to `[]`.
- **Metadata**: `timeMs` is always present. `partial: true` implies a limit (like `maxPaths`) truncated the output. `warnings` contains string explanations (e.g., "Traversal reached maxPaths limit").

## 8. Transaction Semantics
- **Atomicity**: The `EQueryEngine` API is purely read-oriented. Write capabilities (like `insertEntity`) exist for fixture setup and adapter-level usage. 
- **Contract**: SQL adapters require explicit transaction wrappers (`BEGIN`/`COMMIT`) for bulk atomic writes. `InMemoryEngine` writes are instantaneous per-record. Multi-write atomicity is **not** currently guaranteed by the public core API.
