-- E Core Canonical Schema for SQLite
-- This file defines the tables, constraints, and indexes required by the @vxnus/e-sqlite adapter.

CREATE TABLE IF NOT EXISTS e_entities (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  kind TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  identities TEXT,
  provenance TEXT,
  temporal TEXT
);

CREATE TABLE IF NOT EXISTS e_aliases (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
  alias TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS e_relations (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
  predicate TEXT NOT NULL,
  object_id TEXT NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
  provenance TEXT,
  temporal TEXT,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS e_claims (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('canon', 'theory', 'outdated', 'unverified')),
  source TEXT NOT NULL,
  provenance TEXT,
  temporal TEXT
);

CREATE TABLE IF NOT EXISTS e_documents (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  provenance TEXT
);

CREATE INDEX IF NOT EXISTS idx_e_entities_namespace ON e_entities(namespace);
CREATE INDEX IF NOT EXISTS idx_e_entities_slug ON e_entities(slug);
CREATE INDEX IF NOT EXISTS idx_e_aliases_alias ON e_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_e_aliases_entity_id ON e_aliases(entity_id);
CREATE INDEX IF NOT EXISTS idx_e_relations_subject_id ON e_relations(subject_id);
CREATE INDEX IF NOT EXISTS idx_e_relations_object_id ON e_relations(object_id);
CREATE INDEX IF NOT EXISTS idx_e_relations_predicate ON e_relations(predicate);
CREATE INDEX IF NOT EXISTS idx_e_claims_entity_id ON e_claims(entity_id);
CREATE INDEX IF NOT EXISTS idx_e_documents_entity_id ON e_documents(entity_id);
