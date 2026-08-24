# Phase 4 handoff — activate semantic retrieval

**Phase:** 4 — model activation and retrieval quality
**Status:** ready for implementation
**Prerequisite:** an approved embedding model/provider and deployed Teyvat
configuration.

## Outcome

Enable semantic and hybrid retrieval only after embeddings are generated,
revision-consistent, and quality-tested.

## E-owned work

- Finalize the profile and conformance fixtures for the selected model.
- Define deterministic hybrid score normalization and tie-breaking.
- Require citations and a single revision in every semantic response.

## Completion gate

- provider credentials stay server-side;
- semantic capability is true only when the active index is ready;
- unchanged content hashes are not re-embedded;
- semantic, hybrid, and lexical fallback pass conformance and quality tests.
