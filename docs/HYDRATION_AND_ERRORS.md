# Contract Semantics: Hydration and Errors

This document formalizes the expected behavior of any `EQueryEngine` implementation regarding entity hydration and error handling.

## Hydration Guarantees

When a consumer queries the graph, the engine returns a `KnowledgeResult` which includes an `entities` array.

### For `getEntity`
* The engine MUST return the requested entity in the `entities` array if it exists.
* If the entity does not exist, the `entities` array MUST be empty.

### For `findRelations`
If a relation is found between entity A (subject) and entity B (object):
* The engine SHOULD hydrate both entity A and entity B into the `entities` array if they exist in the database.
* The engine MAY omit an entity if it cannot be loaded (e.g., deleted or soft-deleted), but MUST still return the relation edge if the edge itself remains valid in the underlying storage.
* Consumers MUST NOT assume that all related entities are fully hydrated (e.g. for performance reasons on massive queries, an engine might truncate the hydration list). Consumers should fall back to `getEntity` if a required entity ID is found in a relation but missing from the `entities` array.

### For `resolve`
* The engine MUST return the resolved canonical entity in the `entities` array.
* If multiple entities match the alias (e.g., across different namespaces when no namespace is provided), the engine MUST return all matching entities.

### For `search`
* The engine MUST return all matching entities in the `entities` array, up to the optional `limit`.
* The engine MAY return associated documents or claims if the implementation's search spans those models.

## Error and Empty-Result Behavior

E prefers returning empty results over throwing exceptions for missing data.

* **Entity Not Found:** If a query yields no results (e.g., `getEntity` for a non-existent ID, or `findRelations` for an isolated node), the engine MUST return a successful `KnowledgeResult` with empty arrays (`entities: []`, `relations: []`). It MUST NOT throw an error.
* **Invalid Query:** If a query provides invalid or conflicting parameters (e.g., missing both `subjectId` and `objectId` in `findRelations`), the compiler will block it. However, if bypassed at runtime, the engine SHOULD throw a standard Error.
* **Unsupported Query Capability:** If an engine does not support a specific query intent (e.g., `traverse` is unimplemented), it MUST return an empty result and append a string to `metadata.warnings` explaining the limitation (e.g., `"Traverse is not implemented"`).
* **Internal Failure:** If the underlying storage fails (e.g., database connection lost), the engine MUST throw the underlying Error.

This simple, deterministic contract ensures AI consumers do not have to write complex `try/catch` logic for standard graph exploration.
