# Next session handoff

## Current state

The E monorepo is clean and pushed on `main` at commit `38f8598`.

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

## Next objective: authenticated publishing

Build the first publisher flow so every uploaded knowledge pack is attached to
the authenticated Neon Auth account.

1. Verify `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET` in deployment
   environment settings. Keep the cookie domain host-only unless cross-subdomain
   sessions are required.
2. Add an authenticated `/publish` page and upload form.
3. Read the current account from the Neon Auth server session; never accept an
   owner/account ID from the browser.
4. Add publisher ownership to the registry schema, using the Neon Auth user ID
   as the authoritative owner key.
5. Validate the uploaded E pack with `@vxnus/e-knowledge` before persistence.
6. Upload the immutable archive to R2, calculate its archive SHA-256, and insert
   the Neon registry record in an ownership-aware transaction/flow.
7. Return the package identity, version, revision, checksum, and owner to the
   publisher. Public catalog reads stay unauthenticated.

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
