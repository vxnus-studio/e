# E Knowledge Hub

The hosted discovery surface for E knowledge packs. This app is intentionally
small in the first slice: it presents the catalog, explains local Siduri
installation, and gives publishers a place to start.

## Run locally

From this directory, run:

```bash
npm run dev
```

Open <http://localhost:3000>.

## Current slice

- Static landing page at `/`
- `siduri-basics` catalog entry
- Pack detail page at `/packs/siduri-basics`
- Local installation guidance for Siduri
- Publisher entry point

The next slice will add a pack detail route. Registry persistence and artifact
storage remain intentionally outside this first static interface.
