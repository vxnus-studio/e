# Query Contract

E requires a standardized query interface so consumers like Siduri can retrieve knowledge identically regardless of transport.

## The Interface

```typescript
interface EQueryEngine {
  query(request: QueryRequest): Promise<KnowledgeResult>;
}
```

## Request Intents

A `QueryRequest` is a discriminated union of query intents:

1. **Resolve:** Find an entity by alias and namespace.
2. **GetEntity:** Fetch an entity by ID.
3. **FindRelations:** Find directed graph edges. Supports querying by `subjectId`, `objectId`, or both, along with an optional `predicate`.
4. **FindClaims:** Fetch claims asserted about a specific `entityId`.
5. **FindDocuments:** Fetch long-form documents attached to a specific `entityId`.
6. **Search:** Search across entities using a case-insensitive substring match against `name` or `slug` (with optional namespace scoping). Search results are deterministically ordered by `id` ascending. Limit semantics:
   - `limit` omitted or `undefined`: Returns all matching entities.
   - `limit <= 0`: Immediately returns an empty result `[]`.
   - `limit > 0`: Returns up to the specified number of entities.
   *Note: Case-insensitive search is guaranteed for ASCII characters. Full Unicode case-insensitivity depends on the backend engine (e.g., supported by `PostgresEngine`, but not by default in `SqliteEngine`).*
7. **Traverse:** Recursive traversal starting from an ID (currently optional/unsupported by default reference engines).

## Result Contract

The engine returns a hydrated graph slice, not tabular rows.

```typescript
interface KnowledgeResult {
  entities: Entity[];
  relations: Relation[];
  claims: Claim[];
  documents: Document[];
  metadata: QueryMetadata; // Contains timeMs, warnings, etc.
}
```

This ensures AI consumers have self-contained context packages.

For strict rules regarding what an engine *must* return (especially regarding hydration and missing entities), see [HYDRATION_AND_ERRORS.md](./HYDRATION_AND_ERRORS.md).
