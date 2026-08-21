# E Architecture Proposal

## Executive Summary

E is intended to be a **domain-agnostic knowledge layer** and query engine that acts as the canonical source of truth for applications like Siduri. Rather than functioning as a direct database or a domain-specific wiki, E provides a unified knowledge schema, query contract, and retrieval mechanism. It abstracts away storage implementations and provides a standardized way to query entities, relations, claims, and documents regardless of the underlying domain (e.g., Teyvat, Schale, software architectures, or real-world events).

## Core Philosophy

1. **Domain is Data, not Architecture:** The E core contains no hardcoded references to specific fictional universes, games, or real-world domains. Domain specifics are provided via schema extensions, datasets, and ontologies.
2. **Query-Driven, not Storage-Bound:** E defines the conceptual "query contract" and "result contract." Storage (Postgres, vector DBs) is an implementation detail.
3. **AI-First Retrieval:** E is built to serve structured, evidence-backed knowledge to AI consumers (like Siduri's Brain) without requiring the AI to guess via unstructured RAG or reverse-engineer SQL.
4. **Knowledge with Provenance:** Not all stored information is universal truth. Knowledge is modeled as claims supported by evidence from sources, preserving provenance.

## Canonical Model

To represent arbitrary domains, E requires a small set of foundational primitives. 

* **Entity:** A distinctly identifiable concept (a character, a location, a document, an event).
* **Alias:** An alternative name or identifier for an Entity, allowing robust resolution.
* **Relation:** A directed graph edge connecting two Entities via a predicate (e.g., `located_in`, `part_of`).
* **Claim:** An assertion about an Entity or Relation. This decouples the "fact" from the "entity", allowing E to represent conflicting or evolving knowledge.
* **Source / Evidence:** The origin of a Claim (e.g., a specific wiki page, a game file, a document) to ensure provenance.
* **Document (Knowledge Fragment):** Long-form or unstructured text attached to Entities/Claims, primarily for semantic search and retrieval.

Things that should **not** be core primitives:
* **Domain specifics** (e.g., `banner_phases`, `farming_routes`): These belong in domain extensions.

## Identity Model

* **Global Identifiers:** Entities should have a globally unique identifier (e.g., UUID or a URI-like `e://domain/kind/slug`).
* **Namespaces:** IDs and slugs must be scoped to a **Domain Namespace** (e.g., `teyvat`, `schale`, `sys`). This prevents collisions between domains that might share generic terms.
* **Aliases:** Aliases are attached to Entities and can be scoped by language or context.
* **External IDs:** The model must support mapping an Entity to one or more external IDs (e.g., Genshin-DB ID, Wikidata Q-number) to maintain links to ingestion sources.

## Knowledge Semantics

The distinction between entities, relations, and claims is crucial for AI consumers:

```text
Claim (e.g., "Zhongli is the Geo Archon")
  ↓
Asserted by Source (e.g., "Genshin Impact Archive")
  ↓
Supported by Evidence (e.g., "In-game dialogue line 123")
  ↓
Status/Provenance (e.g., Canon, Theory, Outdated)
```

By making Claims explicit, E avoids pretending that every ingested statement is universally true. Siduri's Brain can consume this structure to understand *why* a fact is believed, which is critical for reasoning.

## Query Contract

E is defined by its query semantics. A canonical query model operates at a higher abstraction than SQL or HTTP.

**Core Query Primitives:**
* `Resolve(alias, namespace?)` -> `EntityID`
* `GetEntity(id)` -> `Entity`
* `FindRelations(subjectId, predicate?)` -> `Relation[]`
* `FindClaims(entityId)` -> `Claim[]`
* `Search(query, filters?)` -> `KnowledgeResult`
* `Traverse(startId, path)` -> `Entity[]`

The abstraction must be closer to `query(Intent) -> KnowledgeResult` rather than direct database table access.

## Result Contract

When an AI consumer (like Siduri) queries E, it should receive a cohesive `KnowledgeResult` object, not fragmented database rows.

```typescript
interface KnowledgeResult {
  entities: Entity[];
  relations: Relation[];
  claims: Claim[];
  documents: Document[];
  metadata: QueryMetadata;
}
```
This stable result model ensures that Siduri doesn't need to reconstruct the graph; the graph is delivered as a fully hydrated context package.

## Storage Boundary

E conceptually acts as a **Knowledge Layer over Storage**.
* E owns the Schema definition and Query/Result interfaces.
* Specific adapters implement the storage layer (e.g., `E-Postgres-Adapter`, `E-Vector-Adapter`).
* Retrieving data, generating embeddings, and executing graph traversals are handled by these storage adapters, hidden behind E's query contract.

## Domain Extension Model

Domains (like Teyvat) fit into E via a composition model:
```text
E Core (Engine, Schemas, Query Contract)
   +
Domain Knowledge (Ontology, Ingestion Scripts, Specific Schemas)
```
Domains can define custom schemas (e.g., Teyvat's `banner_phases`) that link back to core `Entity` records. E Core does not validate domain-specific rules; it only enforces the generic Entity/Relation/Claim rules.

## E-Teyvat Mapping

Current `e-teyvat` implements both the generic layer and the domain layer in one monolith.
* **E Core Candidates:** `entities`, `aliases`, `relations`, `knowledge_documents`.
* **Teyvat-Specific Candidates:** `banner_sources`, `banner_phases`, `banner_phase_characters`, `banner_character_statistics`.
* **Migration:** `e-teyvat` should eventually depend on an `e-core` library. The generic tables become E Core tables, while the banner tables remain in the `e-teyvat` schema, referencing E Core Entity IDs.

## Siduri Integration

Siduri's `KnowledgeOrgan` should interact exclusively with the E Query Contract.
```text
Siduri Brain -> KnowledgeOrgan -> E Query Contract -> E Implementation (Teyvat)
```
Siduri should consume `KnowledgeResult` objects, converting them into prompt context or internal memory structures. Information lost during retrieval in the current implementation (like edge metadata or exact source tracing) will be preserved via E's `Claim` and `Provenance` models.

## Transport Architecture

The underlying query semantics must be identical across all transports:
1. **Library:** `e.query({ ... })` (direct use in Node/Bun).
2. **HTTP API:** `POST /query` with a JSON payload matching the library contract.
3. **MCP Server:** `knowledge.query(...)` exposed as an MCP tool for LLMs.

This ensures that whether Siduri imports E directly or accesses it over the network, the behavior is identical.

## Cross-Domain Validation

To prove E generalizes, we test it against three domains:
1. **Teyvat (Fictional):** Entities (Characters, Items), Relations (Drops_From), Claims (Lore facts).
2. **Software Architecture (Technical):** Entities (Services, Databases), Relations (Depends_On), Claims (Service A handles Auth).
3. **Schale (Blue Archive):** Entities (Students, Academies), Relations (Enrolled_In), Claims (Club memberships).

If the E Core schemas and Query Contract can represent and retrieve knowledge for all three without requiring changes to E Core itself, the architecture is validated.

## Migration Proposal

1. **Extract E Core Types:** Move `Entity`, `Relation`, `Alias` definitions to a standalone `e-core` package.
2. **Define Query Interface:** Create the abstract `EQueryClient` interface.
3. **Refactor E-Teyvat:** Modify `e-teyvat` to implement `EQueryClient` using its existing Postgres setup.
4. **Introduce Claims:** Incrementally add the `Claim` and `Provenance` concepts to the schema.
5. **Update Siduri:** Point Siduri to use the new `EQueryClient` interface instead of ad-hoc fetch requests.

## Risks / Open Questions

* **Performance of Graph Traversals:** Abstracting the query layer might make complex recursive SQL joins harder to optimize.
* **Licensing boundaries:** Ensure `E Core` (MIT or similar) is strictly separated from `E-Teyvat` (which handles copyrighted HoYoverse IP). Code coupling here poses a risk.
* **Complexity of Claims:** Modeling every fact as a `Claim` with `Evidence` can lead to data bloat. We must determine if this is strictly required for all data, or only for subjective/lore data.

## Recommended Implementation Phases

* **Phase 1 (Design & Types):** Formalize the generic schema and TypeScript query interfaces in `../e`.
* **Phase 2 (Decoupling E-Teyvat):** Update `../e-teyvat` to consume Phase 1 types and separate domain-specific logic.
* **Phase 3 (Claims & Provenance):** Implement the advanced knowledge semantics (Claims/Sources) in E Core.
* **Phase 4 (Transports):** Build the HTTP and MCP adapters around the core library.
