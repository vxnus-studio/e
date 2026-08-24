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

Copy `.env.example` to `.env.local` when preparing the Supabase and R2 adapters.
The registry uses Supabase when configured and falls back to the built-in
catalog for offline development. Auth pages are custom Hub pages backed by
Supabase Auth at `/auth/sign-in` and `/auth/sign-up`.
The publisher workspace control plane uses the server-only pooled
`DATABASE_URL` connection string. Apply `db/migrations/003_publisher_control_plane.sql`
and `004_registry_packs.sql` to Supabase before enabling project creation.

## Current slice

- Landing page at `/`
- `@vxnus/siduri-basics` catalog entry
- Pack detail page at `/packs/vxnus/siduri-basics` (`@vxnus/siduri-basics` identity)
- Registry API at `/api/packs` and `/api/packs/vxnus/siduri-basics`
- Local installation guidance for Siduri
- Publisher entry point

R2 serves immutable pack artifacts through
`knowledge.e.vxnus.xyz`.
