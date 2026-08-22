# E Core Database Schema Specification

This document details the canonical schema definitions, constraints, indexes, and database types for `@vxnus/e-sqlite` and `@vxnus/e-postgres`.

---

## 1. Table & Column Definitions

### 1.1 `e_entities`
- `id`: `VARCHAR(255) PRIMARY KEY` (Postgres) / `TEXT PRIMARY KEY` (SQLite).
- `namespace`: `VARCHAR(255) NOT NULL` / `TEXT NOT NULL`.
- `kind`: `VARCHAR(255) NOT NULL` / `TEXT NOT NULL`.
- `slug`: `VARCHAR(255) NOT NULL` / `TEXT NOT NULL`.
- `name`: `VARCHAR(255) NOT NULL` / `TEXT NOT NULL`.
- `data`: `JSONB NOT NULL DEFAULT '{}'` / `TEXT NOT NULL DEFAULT '{}'`.
- `identities`: `JSONB` / `TEXT` (JSON array of external provider mappings).
- `provenance`: `JSONB` / `TEXT` (JSON lineage metadata).
- `temporal`: `JSONB` / `TEXT` (JSON temporal semantics).

### 1.2 `e_aliases`
- `id`: `VARCHAR(255) PRIMARY KEY` / `TEXT PRIMARY KEY`.
- `entity_id`: `REFERENCES e_entities(id) ON DELETE CASCADE`.
- `alias`: `VARCHAR(255) NOT NULL` / `TEXT NOT NULL`.

### 1.3 `e_relations`
- `id`: `VARCHAR(255) PRIMARY KEY` / `TEXT PRIMARY KEY`.
- `subject_id`: `REFERENCES e_entities(id) ON DELETE CASCADE`.
- `predicate`: `VARCHAR(255) NOT NULL` / `TEXT NOT NULL`.
- `object_id`: `REFERENCES e_entities(id) ON DELETE CASCADE`.
- `provenance`: `JSONB` / `TEXT`.
- `temporal`: `JSONB` / `TEXT`.
- `metadata`: `JSONB` / `TEXT`.

### 1.4 `e_claims`
- `id`: `VARCHAR(255) PRIMARY KEY` / `TEXT PRIMARY KEY`.
- `entity_id`: `REFERENCES e_entities(id) ON DELETE CASCADE`.
- `statement`: `TEXT NOT NULL`.
- `confidence`: `CHECK (confidence IN ('canon', 'theory', 'outdated', 'unverified'))`.
- `source`: `VARCHAR(255) NOT NULL` / `TEXT NOT NULL`.
- `provenance`: `JSONB` / `TEXT`.
- `temporal`: `JSONB` / `TEXT`.

### 1.5 `e_documents`
- `id`: `VARCHAR(255) PRIMARY KEY` / `TEXT PRIMARY KEY`.
- `entity_id`: `REFERENCES e_entities(id) ON DELETE CASCADE`.
- `content`: `TEXT NOT NULL`.
- `provenance`: `JSONB` / `TEXT`.

---

## 2. Canonical Index Coverage

- `idx_e_entities_namespace` on `e_entities(namespace)`
- `idx_e_entities_slug` on `e_entities(slug)`
- `idx_e_aliases_alias` on `e_aliases(alias)`
- `idx_e_aliases_entity_id` on `e_aliases(entity_id)`
- `idx_e_relations_subject_id` on `e_relations(subject_id)`
- `idx_e_relations_object_id` on `e_relations(object_id)`
- `idx_e_relations_predicate` on `e_relations(predicate)`
- `idx_e_claims_entity_id` on `e_claims(entity_id)`
- `idx_e_documents_entity_id` on `e_documents(entity_id)`
