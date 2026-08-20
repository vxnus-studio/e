# ADR 001: Query Contract Abstraction

## Context
E requires a way to be consumed by different delivery mechanisms (HTTP, MCP, direct library imports) and eventually by Siduri's Brain.

## Decision
We abstract the core retrieval logic into a single method `engine.query(request: QueryRequest): Promise<KnowledgeResult>`. The `QueryRequest` is a discriminated union of query intents (e.g., `resolve`, `getEntity`, `findRelations`). The `KnowledgeResult` returns a hydrated subgraph (entities, relations, claims, documents) rather than flat database rows.

## Consequences
Consumers will always get consistent, structured, AI-ready context packages without having to orchestrate multiple database calls. The E core becomes transport-independent.
