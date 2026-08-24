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
The current API uses the static catalog, so these values are not required yet.
Never expose `NEON_DATABASE_URL` or R2 credentials through `NEXT_PUBLIC_*`.

## Current slice

- Static landing page at `/`
- `@vxnus/siduri-basics` catalog entry
- Pack detail page at `/packs/vxnus/siduri-basics` (`@vxnus/siduri-basics` identity)
- Static registry API at `/api/packs` and `/api/packs/vxnus/siduri-basics`
- Local installation guidance for Siduri
- Publisher entry point

The registry is currently backed by a typed static catalog. Neon will replace
that catalog for registry metadata; R2 will replace the placeholder archive
distribution URL for immutable pack artifacts.
