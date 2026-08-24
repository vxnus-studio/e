# E Knowledge Hub

The hosted discovery surface for E knowledge packs. This app is intentionally
small in the first slice: it presents the catalog, explains local Siduri
installation, and gives publishers a place to start.

The current hosted origin is <https://e.vxnus.xyz>.

## Run locally

From this directory, run:

```bash
npm run dev
```

Open <http://localhost:3000>.

## Environment

Copy `.env.example` to `.env.local` when preparing the Neon and R2 adapters.
The registry uses Neon when `HUB_REGISTRY_MODE=neon`; use `static` for offline
development. These values are required for deployed storage-backed reads.
Never expose `NEON_DATABASE_URL` or R2 credentials through `NEXT_PUBLIC_*`.
Neon Auth also requires `NEON_AUTH_BASE_URL` and a random
`NEON_AUTH_COOKIE_SECRET` (at least 32 characters). Auth pages are available
at `/auth/sign-in` and `/auth/sign-up`.

## Current slice

- Static landing page at `/`
- `@vxnus/siduri-basics` catalog entry
- Pack detail page at `/packs/vxnus/siduri-basics` (`@vxnus/siduri-basics` identity)
- Static registry API at `/api/packs` and `/api/packs/vxnus/siduri-basics`
- Local installation guidance for Siduri
- Publisher entry point

The registry uses Neon when `HUB_REGISTRY_MODE=neon`; use `static` for local
offline development. R2 serves immutable pack artifacts through
`knowledge.e.vxnus.xyz`.
