INSERT INTO registry_packs (
  package_id, name, publisher, version, schema_version, description,
  sources, capabilities, publisher_id, distribution, verified
) VALUES (
  '@vxnus/siduri-basics',
  'Siduri Basics',
  'vxnuslabs',
  '0.1.0',
  '1.0',
  'A tiny knowledge pack used to verify Siduri installation.',
  '[{"id":"siduri-handbook","title":"Siduri Handbook","license":"CC0-1.0"}]'::jsonb,
  '{"lexicalSearch":true,"semanticSearch":false,"structuredEntities":false,"relations":false,"revisions":true}'::jsonb,
  'vxnuslabs',
  '{"kind":"archive","url":"https://knowledge.e.vxnus.xyz/@vxnus/siduri-basics/0.1.0.tar.gz","checksum":"5ec9107e12877b494d2a9fd1de82cb131d8cdb2492b50539eb395f7926df6f42"}'::jsonb,
  TRUE
)
ON CONFLICT (package_id, version) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sources = EXCLUDED.sources,
  capabilities = EXCLUDED.capabilities,
  distribution = EXCLUDED.distribution,
  verified = EXCLUDED.verified;
