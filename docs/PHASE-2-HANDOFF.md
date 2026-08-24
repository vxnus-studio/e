# Phase 2 handoff — hosted provider promotion

**Phase:** 2 — hosted E provider and Hub promotion
**Status:** local verification complete; hosted deployment pending
**Prerequisite:** Phase 1 implementation is pushed; hosted verification remains.

## Outcome

`@vxnus/teyvat` is registered persistently in the E Hub, its provider URL is
reachable, and Siduri can discover it through the public registry.

## E / Hub-owned work

- Store the Teyvat provider distribution in the Neon-backed registry, not only
  the static development registry.
- Verify provider distributions before marking them trusted.
- Keep archive distributions and provider distributions distinct.
- Add registry tests for lookup, version selection, unavailable packs, and the
  Teyvat provider record.
- Document the public registry and provider URL configuration.

## Completion gate

- Hub migration and seed data apply cleanly;
- `/api/packs/@vxnus/teyvat` returns the provider distribution;
- static and Neon registry modes agree on the public contract;
- no private storage or database credentials appear in registry responses;
- Siduri can resolve the provider from the deployed Hub URL.

## Handoff to the next phase

Phase 3 adds optional embedding generation and hybrid ranking behind the
existing lexical E contract. It must preserve provider capability negotiation
and cited results.
