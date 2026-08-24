# Next session handoff

## Current state

The E monorepo is clean and pushed on `main`; see `git log -1` for the latest
handoff commit.

Packages published to npm:

- `@vxnus/e@0.1.2`
- `@vxnus/e-registry@0.1.1`
- `@vxnus/e-knowledge@0.1.2`

The Hub is `apps/web`, hosted at `https://e.vxnus.xyz`.

## Working system

- Supabase Auth owns Hub identities and sessions.
- Drizzle uses Supabase PostgreSQL for publisher projects and registry metadata.
- Supabase tables are defined in `apps/web/db/schema.ts` and applied through
  `003_publisher_control_plane.sql` and `004_registry_packs.sql`.
- R2 bucket `e-knowledge` serves archives through
  `https://knowledge.e.vxnus.xyz`.
- E-Teyvat remains an independent Neon-backed provider.
- Hub registry API:
  - `GET /api/packs`
  - `GET /api/packs/vxnus/siduri-basics?version=0.1.0`
- Custom Supabase Auth pages:
  - `/auth/sign-up`
  - `/auth/sign-in`
  - `/auth/callback`
- `/publish` is the Supabase/Drizzle publisher dashboard.

## Phase 8 progress: Supabase publisher workspace

The authenticated publisher implementation is complete locally. Phase 6 now
focuses on the first production publisher, production verification, and the E
release checklist.

Implemented: Supabase Auth, Drizzle repositories, project ownership, dashboard
UI, project-scoped publishing, transactional release records, and Supabase
schema application. The next session should perform the live account and
release checks below.

Do not put auth, database, R2, or upload lifecycle code into `@vxnus/e`.
Do not use a browser-supplied publisher ID as authorization. Preserve the
package identity format `@publisher/name`; do not introduce slugs.

## Next objective: live publisher verification

See [the pivot decision](PIVOT-SUPABASE-PUBLISHER-DASHBOARD.md) and
[Phase 8 handoff](PHASE-8-HANDOFF.md). Sign up on the live Hub, create a
project, publish a valid archive, and verify the dashboard/public catalog.

## Verification gates

- Anonymous users can browse the catalog but cannot upload.
- An authenticated publisher can upload a valid pack.
- Invalid or mismatched packs fail before an R2/Supabase record is published.
- A publisher cannot modify or delete another account's pack.
- The R2 object checksum equals the Supabase distribution checksum.
- Fresh Vercel install resolves `@vxnus/e-registry` from npm, not a local file.
- Run root `npm test`, then `npm run lint` and `npm run build` in `apps/web`.
- Update this handoff, commit, and push after live verification is complete.

## Useful commands

```bash
npm test
cd apps/web
npm run lint
npm run build
```

Real credentials belong only in `apps/web/.env.local` or deployment settings;
never print or commit them.
