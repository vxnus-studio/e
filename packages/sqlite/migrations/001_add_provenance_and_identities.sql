-- Add TEXT (JSON) columns to entities
ALTER TABLE e_entities ADD COLUMN identities TEXT;
ALTER TABLE e_entities ADD COLUMN provenance TEXT;
ALTER TABLE e_entities ADD COLUMN temporal TEXT;

-- Add TEXT (JSON) columns to relations
ALTER TABLE e_relations ADD COLUMN provenance TEXT;
ALTER TABLE e_relations ADD COLUMN temporal TEXT;
ALTER TABLE e_relations ADD COLUMN metadata TEXT;

-- Add TEXT (JSON) columns to claims
ALTER TABLE e_claims ADD COLUMN provenance TEXT;
ALTER TABLE e_claims ADD COLUMN temporal TEXT;

-- Add TEXT (JSON) columns to documents
ALTER TABLE e_documents ADD COLUMN provenance TEXT;
