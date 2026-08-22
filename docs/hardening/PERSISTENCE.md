# E Core Persistence & Data Integrity Specification

This document establishes the end-to-end field persistence and memory isolation guarantees for `@vxnus/e`, `@vxnus/e-sqlite`, and `@vxnus/e-postgres`.

---

## 1. Field-Level Persistence Matrix

| Model | Field | TypeScript Type | SQLite Column | SQLite INSERT | SQLite SELECT / Mapper | Postgres Column | Postgres INSERT | Postgres SELECT / Mapper | InMemory Storage | Parity & Round-Trip Status |
|---|---|---|---|---|---|---|---|---|---|---|
| **Entity** | `id` | `string` | `id TEXT PRIMARY KEY` | Bound `$1` | Direct string | `id VARCHAR PRIMARY KEY` | Bound `$1` | Direct string | Map Key & `id` | **GUARANTEED** |
| **Entity** | `namespace` | `string` | `namespace TEXT NOT NULL` | Bound `$2` | Direct string | `namespace VARCHAR NOT NULL` | Bound `$2` | Direct string | Property | **GUARANTEED** |
| **Entity** | `kind` | `string` | `kind TEXT NOT NULL` | Bound `$3` | Direct string | `kind VARCHAR NOT NULL` | Bound `$3` | Direct string | Property | **GUARANTEED** |
| **Entity** | `slug` | `string` | `slug TEXT NOT NULL` | Bound `$4` | Direct string | `slug VARCHAR NOT NULL` | Bound `$4` | Direct string | Property | **GUARANTEED** |
| **Entity** | `name` | `string` | `name TEXT NOT NULL` | Bound `$5` | Direct string | `name VARCHAR NOT NULL` | Bound `$5` | Direct string | Property | **GUARANTEED** |
| **Entity** | `data` | `Record<string, unknown>` | `data TEXT NOT NULL DEFAULT '{}'` | `JSON.stringify` | `JSON.parse` | `data JSONB NOT NULL DEFAULT '{}'` | `JSON.stringify` | Native JSONB object | Cloned object | **GUARANTEED** |
| **Entity** | `identities` | `IdentityMapping[]?` | `identities TEXT` | `JSON.stringify` | `JSON.parse` | `identities JSONB` | `JSON.stringify` | Native JSONB object | Cloned array | **GUARANTEED (Fixed Phase 3)** |
| **Entity** | `provenance` | `Provenance?` | `provenance TEXT` | `JSON.stringify` | `JSON.parse` | `provenance JSONB` | `JSON.stringify` | Native JSONB object | Cloned object | **GUARANTEED (Fixed Phase 3)** |
| **Entity** | `temporal` | `TemporalSemantics?` | `temporal TEXT` | `JSON.stringify` | `JSON.parse` | `temporal JSONB` | `JSON.stringify` | Native JSONB object | Cloned object | **GUARANTEED (Fixed Phase 3)** |
| **Alias** | `id` | `string` | `id TEXT PRIMARY KEY` | Bound `$1` | Direct string | `id VARCHAR PRIMARY KEY` | Bound `$1` | Direct string | Array item | **GUARANTEED** |
| **Alias** | `entityId` | `string` | `entity_id TEXT FK` | Bound `$2` | Direct string | `entity_id VARCHAR FK` | Bound `$2` | Direct string | Property | **GUARANTEED** |
| **Alias** | `alias` | `string` | `alias TEXT NOT NULL` | Bound `$3` | Direct string | `alias VARCHAR NOT NULL` | Bound `$3` | Direct string | Property | **GUARANTEED** |
| **Relation** | `id` | `string` | `id TEXT PRIMARY KEY` | Bound `$1` | Direct string | `id VARCHAR PRIMARY KEY` | Bound `$1` | Direct string | Array item | **GUARANTEED** |
| **Relation** | `subjectId` | `string` | `subject_id TEXT FK` | Bound `$2` | `subject_id` mapped | `subject_id VARCHAR FK` | Bound `$2` | `subject_id` mapped | Property | **GUARANTEED** |
| **Relation** | `predicate` | `string` | `predicate TEXT NOT NULL` | Bound `$3` | Direct string | `predicate VARCHAR NOT NULL` | Bound `$3` | Direct string | Property | **GUARANTEED** |
| **Relation** | `objectId` | `string` | `object_id TEXT FK` | Bound `$4` | `object_id` mapped | `object_id VARCHAR FK` | Bound `$4` | `object_id` mapped | Property | **GUARANTEED** |
| **Relation** | `provenance` | `Provenance?` | `provenance TEXT` | `JSON.stringify` | `JSON.parse` | `provenance JSONB` | `JSON.stringify` | Native JSONB object | Cloned object | **GUARANTEED (Fixed Phase 3)** |
| **Relation** | `temporal` | `TemporalSemantics?` | `temporal TEXT` | `JSON.stringify` | `JSON.parse` | `temporal JSONB` | `JSON.stringify` | Native JSONB object | Cloned object | **GUARANTEED (Fixed Phase 3)** |
| **Relation** | `metadata` | `Record<string, unknown>?` | `metadata TEXT` | `JSON.stringify` | `JSON.parse` | `metadata JSONB` | `JSON.stringify` | Native JSONB object | Cloned object | **GUARANTEED (Fixed Phase 3)** |
| **Claim** | `id` | `string` | `id TEXT PRIMARY KEY` | Bound `$1` | Direct string | `id VARCHAR PRIMARY KEY` | Bound `$1` | Direct string | Array item | **GUARANTEED** |
| **Claim** | `entityId` | `string` | `entity_id TEXT FK` | Bound `$2` | `entity_id` mapped | `entity_id VARCHAR FK` | Bound `$2` | `entity_id` mapped | Property | **GUARANTEED** |
| **Claim** | `statement` | `string` | `statement TEXT NOT NULL` | Bound `$3` | Direct string | `statement TEXT NOT NULL` | Bound `$3` | Direct string | Property | **GUARANTEED** |
| **Claim** | `confidence` | `'canon'|'theory'|'outdated'|'unverified'` | `confidence TEXT CHECK` | Bound `$4` | Direct string | `confidence VARCHAR CHECK` | Bound `$4` | Direct string | Property | **GUARANTEED** |
| **Claim** | `source` | `string` | `source TEXT NOT NULL` | Bound `$5` | Direct string | `source VARCHAR NOT NULL` | Bound `$5` | Direct string | Property | **GUARANTEED** |
| **Claim** | `provenance` | `Provenance?` | `provenance TEXT` | `JSON.stringify` | `JSON.parse` | `provenance JSONB` | `JSON.stringify` | Native JSONB object | Cloned object | **GUARANTEED (Fixed Phase 3)** |
| **Claim** | `temporal` | `TemporalSemantics?` | `temporal TEXT` | `JSON.stringify` | `JSON.parse` | `temporal JSONB` | `JSON.stringify` | Native JSONB object | Cloned object | **GUARANTEED (Fixed Phase 3)** |
| **Document** | `id` | `string` | `id TEXT PRIMARY KEY` | Bound `$1` | Direct string | `id VARCHAR PRIMARY KEY` | Bound `$1` | Direct string | Array item | **GUARANTEED** |
| **Document** | `entityId` | `string` | `entity_id TEXT FK` | Bound `$2` | `entity_id` mapped | `entity_id VARCHAR FK` | Bound `$2` | `entity_id` mapped | Property | **GUARANTEED** |
| **Document** | `content` | `string` | `content TEXT NOT NULL` | Bound `$3` | Direct string | `content TEXT NOT NULL` | Bound `$3` | Direct string | Property | **GUARANTEED** |
| **Document** | `provenance` | `Provenance?` | `provenance TEXT` | `JSON.stringify` | `JSON.parse` | `provenance JSONB` | `JSON.stringify` | Native JSONB object | Cloned object | **GUARANTEED (Fixed Phase 3)** |

---

## 2. In-Memory Reference Isolation Guarantees

[`InMemoryEngine`](file:///home/zagin/Projects/vxnuslabs/architecture/e/packages/core/src/engine.ts) guarantees full defensive isolation:
1. **Input Isolation**: Stored entities, aliases, relations, claims, and documents are cloned on `insert*` via `structuredClone` (with fallback to `JSON.parse(JSON.stringify(x))`). Mutating the caller's input object after insert has zero effect on the internal knowledge graph.
2. **Output Isolation**: Results returned by `InMemoryEngine.query()` are cloned before returning. Mutating returned entity objects or nested metadata has zero effect on subsequent queries.

---

## 3. Schema & Serialization Disciplinary Rules

1. **JSON Serialization in SQLite**: SQLite stores JSON as text. Optional JSON fields serialize to `null` if omitted or undefined, and deserializers reconstruct them into plain JavaScript objects.
2. **Native JSONB in PostgreSQL**: PostgreSQL columns are typed as `JSONB`. Mappers directly receive parsed JSON objects from `pg`.
3. **Complex JSON Integrity**: Booleans (`true`/`false`), zero numbers (`0`), empty strings (`""`), empty objects (`{}`), empty arrays (`[]`), nested objects, and explicit `null` values survive round-trip storage across all engines identically.
