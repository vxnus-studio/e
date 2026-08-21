-- Add JSONB columns to entities
ALTER TABLE e_entities ADD COLUMN IF NOT EXISTS identities JSONB;
ALTER TABLE e_entities ADD COLUMN IF NOT EXISTS provenance JSONB;
ALTER TABLE e_entities ADD COLUMN IF NOT EXISTS temporal JSONB;

-- Add JSONB columns to relations
ALTER TABLE e_relations ADD COLUMN IF NOT EXISTS provenance JSONB;
ALTER TABLE e_relations ADD COLUMN IF NOT EXISTS temporal JSONB;
ALTER TABLE e_relations ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add JSONB columns to claims
ALTER TABLE e_claims ADD COLUMN IF NOT EXISTS provenance JSONB;
ALTER TABLE e_claims ADD COLUMN IF NOT EXISTS temporal JSONB;

-- Add JSONB columns to documents
ALTER TABLE e_documents ADD COLUMN IF NOT EXISTS provenance JSONB;
