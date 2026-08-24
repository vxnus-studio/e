# E

E is the portable knowledge-pack and provider contract for Siduri.

It gives knowledge publishers a stable boundary for publishing installable
knowledge: pack identity, versioning, sources, documents, revisions,
provenance-aware retrieval, and optional structured entities and relations.

The contract is storage- and transport-independent. A publisher can expose it
through a local pack, an API, or an adapter over any database. Siduri owns
installation, lifecycle, permissions, and runtime integration.

## Package

`@vxnus/e` exports the TypeScript contract types:

- `KnowledgePackManifest` and `PackCapabilities`
- `PackSource`, `PackDocument`, `PackChunk`, `PackRevision`
- optional `PackEntity` and `PackRelation`
- `KnowledgeProvider`, `RetrievalRequest`, and `RetrievalResponse`

The monorepo also contains:

- `@vxnus/e-registry`: Knowledge Hub discovery and distribution contracts.
- `@vxnus/e-pack`: portable filesystem packs and local retrieval.
- `apps/hub`: the hosted Knowledge Hub product, landing page, registry, and
  pack distribution surface.

```bash
npm install @vxnus/e
```

## Development

```bash
npm run build
```

E intentionally has no database adapters, generic query engine, or backward
compatibility layer for the previous architecture.

See [the pivot decision](docs/PIVOT.md) for the boundary between E, Siduri,
and knowledge publishers. See the [implementation handoff](docs/HANDOFF.md)
for the phased delivery plan, and [the monorepo architecture](docs/MONOREPO.md)
for package and hosting boundaries.
