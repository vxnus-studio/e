# @vxnus/e

The portable knowledge contract for Siduri. It defines pack identity,
versioning, sources, documents, revisions, retrieval, and optional structured
entities and relations.

E does not provide a database engine. Publishers may implement
`KnowledgeProvider` over any storage or transport.

`validateManifest(value)` validates the serialized `manifest.json` boundary.
It rejects unknown fields, requires a semantic pack version, uses an
independent `MAJOR.MINOR` schema version, and returns actionable issues.

The canonical JSON Schema is published at `schema/manifest.schema.json`; the
fixtures in `fixtures/` are the conformance starting point.
