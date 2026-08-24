# Next session handoff

## Current state

The E monorepo is clean and pushed on `main`; see `git log -1` for the latest
handoff commit.

Packages published to npm:

- `@vxnus/e@0.1.1`
- `@vxnus/e-registry@0.1.1`
- `@vxnus/e-knowledge@0.1.1`

The Hub is `apps/web`, hosted at `https://e.vxnus.xyz`.

## Working system

- Neon stores registry metadata in `registry_packs`.
- R2 bucket `e-knowledge` serves archives through
  `https://knowledge.e.vxnus.xyz`.
- `@vxnus/siduri-basics` is seeded in Neon and its archive is uploaded.
- Hub registry API:
  - `GET /api/packs`
  - `GET /api/packs/vxnus/siduri-basics?version=0.1.0`
- Neon Auth UI:
  - `/auth/sign-up`
  - `/auth/sign-in`
  - `/api/auth/[...path]`
- The Hub selects Neon with `HUB_REGISTRY_MODE=neon`; `static` is the explicit
  offline fallback.

## Next objective: publisher adoption and release

The authenticated publisher implementation is complete locally. Phase 6 now
focuses on the first production publisher, production verification, and the E
release checklist.

Implemented:

- Hub-themed responsive Neon sign-up and sign-in shells.
- Authenticated `/publish` page and archive upload form.
- `/api/publish` reads the Neon Auth server session and never accepts an owner
  ID from the browser.
- `.tar.gz`/`.tgz` path-safety checks, E pack validation, archive SHA-256,
  immutable R2 upload, and ownership-aware registry insert.

Remaining verification:

1. Verify `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET` in deployment
   environment settings. Keep the cookie domain host-only unless cross-subdomain
   sessions are required.
2. Run anonymous and authenticated upload checks against deployed services,
   including duplicate versions and invalid archives.
3. Confirm the R2 object checksum equals the Neon distribution checksum.
4. Reconcile any R2 object if cleanup itself fails after a registry insert error.

Phase 6 handoff:

1. Run the production anonymous/authenticated publisher checks on `e.vxnus.xyz`.
2. Confirm the R2 object checksum equals the Neon distribution checksum and
   duplicate package versions are rejected without a second catalog record.
3. Confirm the first publisher can install the published pack through the
   existing catalog/distribution path.
4. Publish the pack authoring guide and release checklist, then prepare the E
   package release.

Do not put auth, database, R2, or upload lifecycle code into `@vxnus/e`.
Do not use a browser-supplied publisher ID as authorization. Preserve the
package identity format `@publisher/name`; do not introduce slugs.

## Verification gates

- Anonymous users can browse the catalog but cannot upload.
- An authenticated publisher can upload a valid pack.
- Invalid or mismatched packs fail before an R2/Neon record is published.
- A publisher cannot modify or delete another account's pack.
- The R2 object checksum equals the Neon distribution checksum.
- Fresh Vercel install resolves `@vxnus/e-registry` from npm, not a local file.
- Run root `npm test`, then `npm run lint` and `npm run build` in `apps/web`.
- Update this handoff, commit, and push when the phase is complete.

## Useful commands

```bash
npm test
cd apps/web
npm run lint
npm run build
```

Real credentials belong only in `apps/web/.env.local` or deployment settings;
never print or commit them.
