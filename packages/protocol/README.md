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

Retrieval uses `validateRetrievalRequest()` and
`validateRetrievalResponse()`. Requests support lexical, semantic, and hybrid
modes with a limit from 0 through 1000. Every returned result must include a
revision and at least one source citation. `assertConformantProvider()` checks
these rules and deterministic repeated retrieval for any provider.
