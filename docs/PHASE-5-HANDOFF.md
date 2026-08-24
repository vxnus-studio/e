# Phase 5 handoff — hosted provider promotion

**Phase:** 5 — production deployment and cross-boundary verification
**Status:** blocked on external deployment configuration
**Prerequisite:** deployment owners provide hosting access and server-side
`DATABASE_URL` configuration for E-Teyvat and E Hub.

## Outcome

The public E Hub resolves `@vxnus/teyvat` to a live Teyvat provider, and Siduri
can retrieve cited, revisioned knowledge through the public URLs.

## Execution

- Deploy the current `main` of E and E-Teyvat through their configured hosting.
- Set Teyvat's `DATABASE_URL` to the fresh Neon database without exposing it to
  clients or Siduri.
- Run `node scripts/check-hosted-integration.mjs` from E.
- Configure Siduri with `SIDURI_KNOWLEDGE_PROVIDER=e-hub`, the Hub URL, and
  `@vxnus/teyvat`; keep `SIDURI_KNOWLEDGE_MODE=lexical` until embeddings are
  intentionally activated.

## Completion gate

- Hub lookup returns the provider distribution;
- Teyvat manifest returns 200 and validates with E;
- lexical retrieval returns cited results and one revision;
- Siduri Hub resolution succeeds;
- no database URL or embedding credential appears in public responses.
