# Phase 3 handoff — semantic and hybrid E retrieval

**Phase:** 3 — optional vector/hybrid retrieval
**Status:** foundation complete; semantic activation pending
**Prerequisite:** Phase 2 hosted provider is live and stable.

## Outcome

E providers may advertise semantic retrieval without breaking lexical-only
consumers or cited result validation.

## E-owned work

- Keep lexical retrieval mandatory for the first provider tier.
- Define embedding metadata: model, dimensions, provider, and content hash.
- Add capability negotiation for `semantic` and `hybrid` modes.
- Preserve deterministic result schemas, revisions, and citations.
- Reject semantic requests when `semanticSearch` is false.
- Add conformance tests for lexical fallback and hybrid responses.

## Delivered foundation

- Added optional, validated embedding metadata (`model`, `dimensions`,
  `provider`) to the E manifest without allowing credentials.
- Kept `semanticSearch: false` for providers without a configured and ready
  index; lexical retrieval remains the compatibility baseline.

## Completion gate

- embedding model and provider are explicitly selected;
- repeated ingestion produces stable embeddings for unchanged content;
- semantic and hybrid results remain cited and revision-consistent;
- Siduri continues to function against lexical-only providers;
- no embedding credentials enter manifests or retrieval responses.

The remaining activation work is handed off to Phase 4.
