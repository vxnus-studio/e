# E Implementation Handoff

This document is the execution plan after the Siduri interoperability pivot.
It is intentionally phased so each phase leaves a usable, reviewable boundary.

## Monorepo shape

The workspace is intentionally split by responsibility:

```text
packages/protocol  @vxnus/e          pack and retrieval contract
packages/registry  @vxnus/e-registry Knowledge Hub registry domain contract
packages/client    @vxnus/e-client   registry/provider client wrappers
```

The future hosted Hub application, persistence adapter, authentication, and
deployment configuration should live in a separate application package. They
must depend on these contracts rather than move hosting concerns into core.

## Outcome

Publishers should be able to produce one E-compatible knowledge pack, while
Siduri can install it locally or consume the same contract from a provider.
E owns the contract and conformance rules. Publishers own content and storage;
Siduri owns installation, lifecycle, permissions, and runtime composition.

## Phase 0 — Baseline and ownership

Status: complete.

Deliverables:

- Remove the generic database engines and their compatibility surface.
- Keep `@vxnus/e` as the protocol package and establish registry/client package
  boundaries for the future Knowledge Hub.
- Record the E/Siduri/publisher boundary in [PIVOT.md](./PIVOT.md).

Acceptance:

- The repository has no backend adapter, generic query engine, or legacy API.
- Registry and client code depend on contracts, not on a chosen web framework
  or database.
- `npm run build` succeeds.

## Phase 1 — Pack manifest and validation

Owner: E.

Deliverables:

- Define the serialized `manifest.json` format for `KnowledgePackManifest`.
- Specify identifier, semantic version, schema version, publisher, source,
  license, and capability rules.
- Add runtime validation with actionable errors.
- Add valid and invalid conformance fixtures.
- Document whether unknown fields are ignored or rejected; default to rejected
  for the first version.

Acceptance:

- A publisher can validate a manifest without Siduri.
- Every required field and capability combination has a fixture.
- The schema version is independent of a pack's content version.

Do not add storage, HTTP, database drivers, or Siduri-specific lifecycle code.

## Phase 2 — Portable local pack

Owner: E, with a publisher fixture.

Deliverables:

- Define the pack directory/archive layout.
- Add a small filesystem loader for the manifest and content records.
- Validate references between sources, documents, chunks, entities, and
  relations.
- Include one tiny sample pack suitable for tests and documentation.
- Define deterministic revision and content-hash behavior.

Acceptance:

- A pack can be copied to another machine and validated there.
- Retrieval results include a revision and at least one source citation.
- Corrupt, incomplete, or mismatched packs fail before installation.

## Phase 3 — Retrieval and conformance

Owner: E.

Deliverables:

- Finalize `KnowledgeProvider`, retrieval request, and response semantics.
- Define limit, empty-result, unsupported-capability, and partial-result rules.
- Require citations for factual retrieval results.
- Add a provider conformance runner that any implementation can execute.

Acceptance:

- The sample local provider passes all conformance tests.
- A provider can explicitly advertise unsupported semantic search or relations.
- Results are deterministic for the same pack, revision, and request.

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

## Phase 5 — Knowledge Hub and remote providers

Owner: Siduri Knowledge Hub, with E conformance support.

Deliverables:

- Define pack discovery and publisher metadata for the Hub.
- Support remote E providers using the same manifest and retrieval contract.
- Add authentication, trust, timeout, size, and rate-limit policy outside E.
- Add install/update verification and publisher revision visibility.

Acceptance:

- The same pack works locally and remotely without a custom Siduri adapter.
- Remote failures are isolated and clearly reported.
- Hub policy cannot weaken E validation or citation requirements.

## Phase 6 — Publisher adoption and release

Owner: E plus the first production publisher.

Deliverables:

- Publish a pack authoring guide and release checklist.
- Publish conformance tooling and a reference implementation.
- Establish compatibility policy for future schema versions.
- Release E 0.3 as the first clean-break contract release.

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
- [ ] Siduri-specific behavior remains outside this repository.
