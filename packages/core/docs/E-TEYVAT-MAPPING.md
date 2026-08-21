# E-Teyvat Mapping

This document maps the concepts in the existing `e-teyvat` implementation to the new `E Core` architecture.

## Boundary Definitions

| Concept                | E Core         | Teyvat-Specific | Notes |
| ---------------------- | -------------- | --------------- | ----- |
| `entities`             | Yes (Entity)   | No              | E core holds the schema and relations. |
| `aliases`              | Yes (Alias)    | No              | Used for robust resolution. |
| `relations`            | Yes (Relation) | No              | The generic directed graph edge. |
| `knowledge_documents`  | Yes (Document) | No              | Long-form contextual text. |
| `sync_runs`            | Yes (optional) | No              | System-level concept, possibly part of core ingestion/provenance. |
| `banner_sources`       | No             | Yes             | Highly specific to Genshin. |
| `banner_phases`        | No             | Yes             | Genshin specific. |
| `banner_phase_characters`| No             | Yes             | Genshin specific. |
| `banner_character_statistics` | No        | Yes             | Genshin specific. |

## Future Migration

When `e-teyvat` is migrated, it should drop its local copies of the generic types (`Entity`, `Relation`, `Alias`) and import them from the `e` core package. `e-teyvat` will implement `EQueryEngine` wrapping its Neon Postgres database, keeping all generic SQL operations compliant with the query contract. The domain-specific tables will be queried either as extensions within the engine implementation or directly via domain-specific API routes layered alongside E.
