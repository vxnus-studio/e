# Phase 8 handoff — Supabase publisher dashboard

**Phase:** 8 — user-owned publisher workspace
**Status:** implementation complete; live publisher verification pending
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

## Implemented

- Supabase Auth powers the custom Hub sign-up and sign-in pages.
- `/auth/callback` exchanges email verification codes for a session.
- Next 16 `proxy.ts` refreshes Supabase session cookies.
- Drizzle ORM uses the server-only Supabase PostgreSQL `DATABASE_URL`.
- `/publish` is an application dashboard with sidebar navigation, project
  context, release metrics, release table, empty states, and pack ingestion.
- Publishing verifies project ownership and transactionally records a revision,
  registry row, release, distribution, and audit event.
- R2 remains the immutable archive store; E validation and checksums are kept.
- Supabase migrations are `apps/web/db/migrations/003_publisher_control_plane.sql`
  and `004_registry_packs.sql`.

## Completion gate

- users can create and view only their own projects;
- anonymous users can browse public releases but cannot publish;
- duplicate package/version releases are rejected atomically;
- Supabase service credentials never reach the browser or provider responses;
- E-Teyvat remains an independent Neon-backed provider;
- existing Hub catalog and Siduri provider resolution remain compatible.

## Live verification remaining

1. Sign up at `https://e.vxnus.xyz/auth/sign-up` and confirm the email.
2. Create a project from `/publish`.
3. Upload a valid fixture or publisher archive and confirm the release appears
   in the dashboard table and public catalog.
4. Retry the same package/version and confirm the atomic duplicate rejection.
5. Confirm a second account cannot read or modify the first account's project.

The local Supabase project has the schema applied and the unauthenticated
guards have been checked. No test user or test release was created by Codex.
