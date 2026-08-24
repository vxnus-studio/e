# Phase 8 handoff — Supabase publisher dashboard

**Phase:** 8 — user-owned publisher workspace
**Status:** documentation complete; implementation next
**Prerequisite:** Supabase project and Auth configuration are available.

## Outcome

E Hub becomes a multi-tenant publisher workspace. Users own knowledge projects
and releases; E Hub provides discovery, permissions, and publishing workflow.

## E-owned work

- Add Supabase Auth session verification and server-side authorization.
- Add project, member, source, revision, release, distribution, and audit
  repositories with tenant isolation.
- Replace upload-only `/publish` with an owned-project dashboard.
- Preserve archive checksum, immutable versions, provider URLs, and E
  validation.
- Migrate existing registry metadata with a reversible cutover.

## Completion gate

- users can create and view only their own projects;
- anonymous users can browse public releases but cannot publish;
- duplicate package/version releases are rejected atomically;
- Supabase service credentials never reach the browser or provider responses;
- E-Teyvat remains an independent Neon-backed provider;
- existing Hub catalog and Siduri provider resolution remain compatible.
