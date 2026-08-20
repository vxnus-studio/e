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
3. **FindRelations:** Find directed graph edges for an entity.
4. **Search:** Search across entities, aliases, and documents.

## Result Contract

The engine returns a fully hydrated graph slice, not tabular rows.

```typescript
interface KnowledgeResult {
  entities: Entity[];
  relations: Relation[];
  claims: Claim[];
  documents: Document[];
}
```

This ensures AI consumers have self-contained context packages.
