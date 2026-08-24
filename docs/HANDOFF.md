# E Implementation Handoff

This document is the execution plan after the Siduri interoperability pivot.
It is intentionally phased so each phase leaves a usable, reviewable boundary.

## Monorepo shape

The workspace is intentionally split by responsibility:

```text
packages/protocol  @vxnus/e          pack and retrieval contract
packages/registry  @vxnus/e-registry Knowledge Hub registry domain contract
apps/web           hosted Knowledge Hub, registry API, landing page, delivery
```

The Hub application, persistence adapter, authentication, and deployment
configuration live under `apps/web`. It depends on the contract packages;
hosting concerns must not move into protocol code.

## Outcome

Publishers should be able to produce one E-compatible knowledge pack, while
Siduri can install it locally or consume the same contract from a provider.
E owns the contract and conformance rules. Publishers own content and storage;
Siduri owns installation, lifecycle, permissions, and runtime composition.

## Phase 0 — Baseline and ownership

Status: complete.

Deliverables:

- Remove the generic database engines and their compatibility surface.
- Keep `@vxnus/e` as the protocol package, `@vxnus/e-registry` as the registry
  domain package, and establish `apps/hub` as the hosted product boundary.
- Record the E/Siduri/publisher boundary in [PIVOT.md](./PIVOT.md).

Acceptance:

- The repository has no backend adapter, generic query engine, or legacy API.
- The Hub depends on contracts, not the other way around.
- `npm run build` succeeds.

## Phase 1 — Pack manifest and validation

Owner: E. Status: complete.

Deliverables:

- Define the serialized `manifest.json` format for `KnowledgePackManifest`.
- Specify identifier, semantic version, schema version, publisher, source,
  license, and capability rules.
- Add runtime validation with actionable errors.
- Add valid and invalid conformance fixtures.
- Document whether unknown fields are ignored or rejected; default to rejected
  for the first version.

Implemented in `packages/protocol`:

- `schema/manifest.schema.json` is the canonical serialized shape.
- `validateManifest(value)` is the runtime boundary.
- `fixtures/manifest.valid*.json` and five invalid fixtures cover the initial
  conformance cases.
- Unknown fields are rejected; pack versions use SemVer and schema versions
  use independent `MAJOR.MINOR` numbering.

Acceptance:

- A publisher can validate a manifest without Siduri.
- Every required field and capability combination has a fixture.
- The schema version is independent of a pack's content version.
- `npm test` passes the manifest fixture suite.

Do not add storage, HTTP, database drivers, or Siduri-specific lifecycle code.

## Phase 2 — Portable local pack

Owner: E, with a publisher fixture. Status: complete.

Deliverables:

- Define the pack directory/archive layout.
- Add a small filesystem loader for the manifest and content records.
- Validate references between sources, documents, chunks, entities, and
  relations.
- Include one tiny sample pack suitable for tests and documentation.
- Define deterministic revision and content-hash behavior.

Implemented in `packages/knowledge`:

- `loadPack(directory)` loads the documented filesystem layout.
- Records are checked for unique IDs and valid source/document/chunk/entity,
  relation, and revision references.
- Revision hashes use deterministic SHA-256 over sorted content records.
- The sample pack provides a local lexical provider with citations.
- `fixtures/siduri-basics/` provides the first Siduri integration fixture.

Acceptance:

- A pack can be copied to another machine and validated there.
- Retrieval results include a revision and at least one source citation.
- Corrupt, incomplete, or mismatched packs fail before installation.
- `npm test` passes both manifest and local-pack fixture suites.

## Phase 3 — Retrieval and conformance

Owner: E. Status: complete.

Deliverables:

- Finalize `KnowledgeProvider`, retrieval request, and response semantics.
- Define limit, empty-result, unsupported-capability, and partial-result rules.
- Require citations for factual retrieval results.
- Add a provider conformance runner that any implementation can execute.

Implemented in `packages/protocol`:

- `validateRetrievalRequest()` defines mode and limit validation.
- `validateRetrievalResponse()` requires revisions and citations on every
  result.
- `assertConformantProvider()` checks deterministic bounded retrieval,
  response shape, and rejection of unsupported semantic retrieval.

Acceptance:

- The sample local provider passes all conformance tests.
- A provider can explicitly advertise unsupported semantic search or relations.
- Results are deterministic for the same pack, revision, and request.
- `npm test` passes the provider conformance suite against the local pack.

## Phase 4 — Siduri KnowledgeOrgan integration

Owner: Siduri.

Deliverables:

- Adapt an installed E pack/provider into `KnowledgeOrgan`.
- Add discovery, install, enable, disable, update, and uninstall flows.
- Enforce permissions and companion scoping in Siduri.
- Surface pack identity, revision, capabilities, and citation metadata to the
  brain.

Acceptance:

- `siduri create` can install the sample pack locally.
- The brain receives grounded content with citations and revision metadata.
- Removing or updating a pack does not affect companion memory.

E should only change here when the interoperability contract is incomplete.

## Phase 5 — Hosted Knowledge Hub and remote providers

Owner: Siduri Knowledge Hub, with E conformance support. Status: in progress.

Deliverables:

- Build the npm-like Hub landing page and registry API in `apps/web`.
- Define pack discovery and publisher metadata for the Hub.
- Serve archives and remote E provider metadata using the same contract.

First slice implemented in `apps/web`: a static landing/catalog page and pack
detail route for `@vxnus/siduri-basics`, with manifest metadata, revision, source,
content hash, capabilities, and local Siduri installation guidance. Registry
data and distribution are still static until the Hub API is introduced.

The detail route is available at `/packs/vxnus/siduri-basics`; the canonical
package identity remains `@vxnus/siduri-basics`. Its displayed fact and
metadata mirror the checked-in fixture at
`packages/knowledge/fixtures/siduri-basics/`; this is deliberately duplicated
as static Hub data until the registry API exists.

Local integration proof: Siduri's `EKnowledgeAdapter` loads that fixture and
returns `Siduri is a persistent companion runtime.` with revision `r1` and
citation `siduri-handbook / welcome / welcome-1`.

Verification note: the adapter package builds and the direct smoke check
passes. Its Jest runner remains blocked before test execution by the existing
Jest runtime error `clearMocksOnScope is not a function`.

Registry API slice: `apps/web/lib/registry.ts` selects the Neon implementation
when `HUB_REGISTRY_MODE=neon` and the in-memory implementation when explicitly
set to `static`. `GET /api/packs` supports `q` and `limit`;
`GET /api/packs/vxnus/siduri-basics?version=0.1.0` returns the versioned
`RegistryPack`; unknown packages return `pack_not_found` with HTTP 404. The
Hub pages consume this registry boundary rather than maintaining their own
pack metadata.

Storage phase proof: Neon schema `db/migrations/001_registry_packs.sql` and
seed `002_seed_siduri_basics.sql` are applied. The 0.1.0 fixture archive is
uploaded to R2 at
`https://knowledge.e.vxnus.xyz/@vxnus/siduri-basics/0.1.0.tar.gz` and its
object head check passes. Its archive SHA-256 is
`5ec9107e12877b494d2a9fd1de82cb131d8cdb2492b50539eb395f7926df6f42`, and the
Neon record carries that checksum. `apps/web/lib/neon-registry.ts` and
`apps/web/lib/r2.ts` are server-only adapters; Neon and R2 credentials remain
server-only.

Environment handoff: `apps/web/.env.example` defines the Neon registry, Hub
origin, R2, and Neon Auth configuration. The local environment uses Neon for
registry reads; credentials remain server-only.

Auth phase: Neon Auth is wired through `@neondatabase/auth` and
`@neondatabase/auth-ui`. Sign-up and sign-in are available at
`/auth/sign-up` and `/auth/sign-in`; the auth proxy is mounted at
`/api/auth/[...path]`, and the landing navigation exposes both entry points.
Required server configuration is `NEON_AUTH_BASE_URL` and a random
`NEON_AUTH_COOKIE_SECRET` (32+ characters). The current local env has not
populated those two keys yet. Publisher/account ownership must be attached to
upload records in the next upload phase; public catalog reads remain
unauthenticated.
- Add authentication, trust, timeout, size, and rate-limit policy outside E.
- Add install/update verification and publisher revision visibility.

Acceptance:

- Siduri can discover a pack, install it locally, or connect to its remote
  provider without a custom integration.
- Remote failures are isolated and clearly reported.
- Hub policy cannot weaken E validation or citation requirements.

## Phase 6 — Publisher adoption and release

Owner: E plus the first production publisher.

Deliverables:

- Publish a pack authoring guide and release checklist.
- Publish conformance tooling and a reference implementation.
- Establish compatibility policy for future schema versions.
- Release E 0.1.0 as the first clean-break contract release.

Acceptance:

- An independent publisher can implement the contract from the docs alone.
- A pack can be installed through the official Siduri flow.
- No phase depends on the removed database packages or legacy engine API.

## Decision gates

- Do not implement Phase 2 until Phase 1 fixtures define the serialized shape.
- Do not integrate with Siduri until Phase 3 conformance behavior is stable.
- Do not add remote transport requirements to E; keep them in Siduri/Hub.
- Do not restore backward compatibility with the pre-pivot engine API.

## Handoff checklist

- [ ] Phase owner and reviewer assigned.
- [ ] Contract changes are represented in types, fixtures, and docs.
- [ ] Acceptance checks pass before moving phases.
- [ ] Publisher content remains separate from E protocol code.
- [ ] Siduri-specific runtime behavior remains outside `apps/web` and this repo.
