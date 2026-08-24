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
The registry remains on its current adapter during the Supabase migration; use
`static` for offline development. Auth pages are custom Hub pages backed by
Supabase Auth at `/auth/sign-in` and `/auth/sign-up`.
The publisher workspace control plane uses `SUPABASE_URL` (the same value as
`NEXT_PUBLIC_SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY` server-side. Apply
`db/migrations/003_publisher_control_plane.sql` to Supabase before enabling
project creation. The service key must never use a `NEXT_PUBLIC_*` name.

## Current slice

- Landing page at `/`
- `@vxnus/siduri-basics` catalog entry
- Pack detail page at `/packs/vxnus/siduri-basics` (`@vxnus/siduri-basics` identity)
- Registry API at `/api/packs` and `/api/packs/vxnus/siduri-basics`
- Local installation guidance for Siduri
- Publisher entry point

The registry uses Neon when `HUB_REGISTRY_MODE=neon`; use `static` for local
offline development. R2 serves immutable pack artifacts through
`knowledge.e.vxnus.xyz`.
