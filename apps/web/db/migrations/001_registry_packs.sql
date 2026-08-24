CREATE TABLE IF NOT EXISTS registry_packs (
  package_id TEXT NOT NULL,
  name TEXT NOT NULL,
  publisher TEXT NOT NULL,
  version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  description TEXT,
  sources JSONB NOT NULL,
  capabilities JSONB NOT NULL,
  publisher_id TEXT NOT NULL,
  distribution JSONB NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (package_id, version)
);

CREATE INDEX IF NOT EXISTS registry_packs_publisher_idx ON registry_packs (publisher_id);
