# Phase 1 handoff — E remote provider contract

**Phase:** 1 — E-compatible remote provider
**Status:** planned
**Scope:** lexical retrieval, structured metadata, revisions, and citations.
Vector search is explicitly out of scope.

## Outcome

An E publisher can expose a live provider, the Hub can register it as a
`provider` distribution, and a consumer can discover and validate it without
knowing its database or implementation details.

## E-owned work

- Keep `KnowledgeProvider`, manifest, and retrieval types as the wire contract.
- Add a remote HTTP provider to `@vxnus/e-knowledge`.
- Validate the remote manifest and every retrieval response with the existing
  protocol validators.
- Support timeouts, bounded transient retries, deterministic URL handling, and
  an optional requested revision.
- Keep the filesystem-pack provider unchanged for offline use.
- Use the existing registry `distribution.kind: "provider"` contract for Hub
  discovery; do not add Teyvat-specific fields to the protocol.

## Provider contract

The remote provider base URL exposes:

- `GET {baseUrl}/manifest`
- `POST {baseUrl}/retrieve`

The manifest must advertise `lexicalSearch: true`; each result must contain a
matching revision and at least one citation.

## Completion gate

- protocol and knowledge packages build;
- remote-provider unit tests cover manifest failure, timeout, `503`, malformed
  retrieval, revision mismatch, and successful cited retrieval;
- local pack fixtures continue to pass unchanged;
- no database or Teyvat-specific types enter the E protocol package.

## Handoff to the next phase

Phase 2 may harden hosted deployment, cache behavior, and provider promotion.
Phase 3 may add vector/hybrid retrieval; it must not change the lexical
contract.
