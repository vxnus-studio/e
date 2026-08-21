-- E Core Canonical Schema for PostgreSQL
-- This file defines the tables, constraints, and indexes required by the @e/postgres adapter.

CREATE TABLE IF NOT EXISTS e_entities (
  id VARCHAR(255) PRIMARY KEY,
  namespace VARCHAR(255) NOT NULL,
  kind VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'
);

-- Index for namespace filtering and search
CREATE INDEX IF NOT EXISTS idx_e_entities_namespace ON e_entities(namespace);
CREATE INDEX IF NOT EXISTS idx_e_entities_slug ON e_entities(slug);

CREATE TABLE IF NOT EXISTS e_aliases (
  id VARCHAR(255) PRIMARY KEY,
  entity_id VARCHAR(255) NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
  alias VARCHAR(255) NOT NULL
);

-- Index for alias resolution
CREATE INDEX IF NOT EXISTS idx_e_aliases_alias ON e_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_e_aliases_entity_id ON e_aliases(entity_id);

CREATE TABLE IF NOT EXISTS e_relations (
  id VARCHAR(255) PRIMARY KEY,
  subject_id VARCHAR(255) NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
  predicate VARCHAR(255) NOT NULL,
  object_id VARCHAR(255) NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE
);

-- Indexes for forward, reverse, and exact relation lookups
CREATE INDEX IF NOT EXISTS idx_e_relations_subject_id ON e_relations(subject_id);
CREATE INDEX IF NOT EXISTS idx_e_relations_object_id ON e_relations(object_id);
CREATE INDEX IF NOT EXISTS idx_e_relations_predicate ON e_relations(predicate);

CREATE TABLE IF NOT EXISTS e_claims (
  id VARCHAR(255) PRIMARY KEY,
  entity_id VARCHAR(255) NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  confidence VARCHAR(50) NOT NULL CHECK (confidence IN ('canon', 'theory', 'outdated')),
  source VARCHAR(255) NOT NULL
);

-- Index for fetching claims by entity
CREATE INDEX IF NOT EXISTS idx_e_claims_entity_id ON e_claims(entity_id);

CREATE TABLE IF NOT EXISTS e_documents (
  id VARCHAR(255) PRIMARY KEY,
  entity_id VARCHAR(255) NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
  content TEXT NOT NULL
);

-- Index for fetching documents by entity
CREATE INDEX IF NOT EXISTS idx_e_documents_entity_id ON e_documents(entity_id);
