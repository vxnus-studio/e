# E Core Canonical Contract Specification (Phase 2 Update)

This document defines the strict, authoritative semantic contract for `@vxnus/e` and all compliant storage engines (`InMemoryEngine`, `SqliteEngine`, `PostgresEngine`).

---

## 1. Core Data Model & Constraints

### 1.1 `Entity`
- **`id`** (`string`, Non-empty): Unique primary key.
- **`namespace`** (`string`, Non-empty): Domain/partition identifier.
- **`kind`** (`string`, Non-empty): Entity type/category.
- **`slug`** (`string`, Non-empty): URL-safe human identifier.
- **`name`** (`string`): Display name.
- **`data`** (`Record<string, unknown>`): Arbitrary structured JSON data payload.
- **`identities`** (`IdentityMapping[]`, Optional): External provider identifiers (`provider`, `externalId`).
- **`provenance`** (`Provenance`, Optional): Source lineage metadata (`provider`, `source`, `confidence`, etc.).
- **`temporal`** (`TemporalSemantics`, Optional): Validity and observation timestamps.

### 1.2 `Alias`
- **`id`** (`string`, Non-empty): Unique primary key.
- **`entityId`** (`string`): Foreign key referencing `Entity.id`. Cascade delete required.
- **`alias`** (`string`): Alternative identifier used for `resolve` queries.

### 1.3 `Relation`
- **`id`** (`string`, Non-empty): Unique primary key.
- **`subjectId`** (`string`): Foreign key referencing `Entity.id`. Cascade delete required.
- **`predicate`** (`string`, Non-empty): Directed edge relation type.
- **`objectId`** (`string`): Foreign key referencing `Entity.id`. Cascade delete required.
- **`provenance`** (`Provenance`, Optional): Source metadata.
- **`temporal`** (`TemporalSemantics`, Optional): Temporal validity.
- **`metadata`** (`Record<string, unknown>`, Optional): Structured relation properties.

### 1.4 `Claim`
- **`id`** (`string`, Non-empty): Unique primary key.
- **`entityId`** (`string`): Foreign key referencing `Entity.id`. Cascade delete required.
- **`statement`** (`string`): Factual assertion.
- **`confidence`** (`'canon' | 'theory' | 'outdated' | 'unverified'`): Strict enumeration.
- **`source`** (`string`): Source citation.
- **`provenance`** (`Provenance`, Optional): Lineage metadata.
- **`temporal`** (`TemporalSemantics`, Optional): Temporal validity.

### 1.5 `Document`
- **`id`** (`string`, Non-empty): Unique primary key.
- **`entityId`** (`string`): Foreign key referencing `Entity.id`. Cascade delete required.
- **`content`** (`string`): Text body.
- **`provenance`** (`Provenance`, Optional): Lineage metadata.

---

## 2. Query Operation Contracts

All queries are executed via `engine.query(request: QueryRequest)` and return `Promise<KnowledgeResult>`.

### 2.1 `getEntity`
- **Input**: `{ type: "getEntity", id: string }`
- **Behavior**: Retrieves entity by exact ID.
- **Output**: `entities` contains 1 element if found, or 0 if missing. Never throws on missing entity.

### 2.2 `resolve`
- **Input**: `{ type: "resolve", alias: string, namespace?: string }`
- **Behavior**: Exact match lookup by alias, optionally scoped to namespace.
- **Case Sensitivity**: Exact case-sensitive match (`"Alpha"` does not match `"alpha"`).
- **Deduplication**: Distinct entity records only (an entity matching via multiple duplicate aliases is returned once).

### 2.3 `findRelations`
- **Input**: `{ type: "findRelations", subjectId?: string, objectId?: string, predicate?: string }`
- **Validation**: Throws `QueryError` if neither `subjectId` nor `objectId` is provided.
- **Hydration**: Returns matching relations in `relations` AND hydrated subject/object entities in `entities`.

### 2.4 `findClaims` & `findDocuments`
- **Input**: `{ type: "findClaims" | "findDocuments", entityId: string }`
- **Behavior**: Retrieves claims/documents for target entity. Does not hydrate entity. Never throws on missing entity.

### 2.5 `search`
- **Input**: `{ type: "search", search: SearchQuery }`
- **Fields Searched**: Substring match against entity `name` and `slug`.
- **Modes**:
  - `lexical`: Supported by all engines.
  - `semantic` / `hybrid`: Unsupported in base engines (throws `UnsupportedOperationError`).
- **Escaping**: Wildcards `%` and `_` are treated as literal characters across all backends.
- **Limit Domain**: `limit` must be non-negative integer $\le 10,000$. Negative or non-integer throws `QueryError`. Limit 0 returns empty array.
- **Ordering**: Ascending ID binary collation order before slicing to `limit`.

### 2.6 `traverse`
- **Input**: `{ type: "traverse", startId: string, steps?: TraversalStep[], maxDepth?: number, maxPaths?: number, predicates?: string[] }`
- **Validation Order (Phase 2 Guarantee)**:
  - Input parameter validation (`maxDepth`, `maxPaths`) is evaluated **strictly prior** to start entity existence checks.
  - An invalid `maxDepth` (e.g. `-1` or `1.5`) or `maxPaths` (e.g. `-1`) throws `QueryError` immediately across all backends, regardless of whether `startId` exists in storage.
- **Boundaries**:
  - `maxDepth`: Integer in $[0, 100]$. Defaults to 5.
  - `maxPaths`: Integer in $[0, 100,000]$. Defaults to 1,000.
- **Direction**: `"out"` (subject -> object), `"in"` (object -> subject), or `"both"`.
- **Cycle Prevention**: A path cannot traverse the same `relationId` more than once.
- **Path Ordering**: Deterministic sort by `depth ASC`, then concatenated relation IDs, then `endId`.
- **Partial Indicator**: `metadata.partial === true` if and only if actual truncation occurred due to `maxPaths`.

---

## 3. Error Model Contract

Engines normalize all failures into standard exported error classes:
- **`ConstraintError`**: Primary key duplicates, foreign key violations, check constraint failures.
- **`QueryError`**: Malformed queries, invalid arguments (e.g. invalid `maxDepth`, negative `limit`, missing relation endpoints).
- **`UnsupportedOperationError`**: Unimplemented query types or search modes.
