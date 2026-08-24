# Pivot decision — Supabase-backed publisher dashboard

**Status:** approved for implementation
**Scope:** E Hub publisher control plane

## Decision

Move E Hub authentication, publisher identity, project metadata, registry
records, and dashboard state from direct Neon usage to Supabase. Use Supabase
Auth as the real authentication boundary. Supabase Postgres is the Hub control
plane; it is not the storage engine for provider knowledge content.

E-Teyvat may continue using its own Neon database for the public Teyvat
projection and retrieval API. Siduri never receives either database URL.

```text
User ── Supabase Auth ── E Hub dashboard ── Supabase control plane
                                      ├── archive/provider metadata
                                      ├── ownership and permissions
                                      └── release/revision records

gi-data ── E-Teyvat/Neon ── public E provider ── Siduri
```

## Ownership model

- A Supabase user owns one or more publisher projects.
- A project owns package IDs, sources, revisions, releases, and distributions.
- Collaborators receive explicit project roles; browser input never supplies
  the authoritative owner ID.
- E Hub stores metadata and permissions, not private source content or provider
  database credentials.
- `@vxnus/teyvat` remains the first-party `vxnuslabs` project; user projects
  use their own publisher identity and package namespace.

## Publisher dashboard outcome

Replace the upload-only `/publish` page with an authenticated workspace:

- overview of owned projects and release health;
- create/import project flow;
- source and license management;
- revision validation and immutable release history;
- archive or remote-provider distribution setup;
- visibility and collaborator permissions;
- checksum, deployment, and retrieval status;
- revoke/rollback controls with an audit trail.

Uploading an E pack remains one ingestion action inside the project workflow,
not the dashboard’s complete product model.

## Supabase boundaries

Use Supabase server-side for Auth session verification and service operations.
Use the browser only with the public Supabase URL and publishable key. Keep
service-role keys, storage credentials, provider credentials, and database URLs
server-side. Enforce ownership in database policies and server-side checks.

Initial control-plane tables:

- `publisher_projects`;
- `publisher_members`;
- `publisher_sources`;
- `publisher_revisions`;
- `publisher_releases`;
- `publisher_distributions`;
- `publisher_audit_events`.

Each table must carry the project owner/tenant relationship and timestamps.
Package IDs and versions remain immutable after release.

## Migration sequence

1. Create the Supabase project, Auth configuration, and control-plane schema.
2. Implement a Supabase repository behind the existing Hub registry boundary.
3. Migrate the first-party and existing publisher metadata with checksum parity.
4. Replace the current Neon Auth UI/session adapter with Supabase Auth.
5. Build the project/revision/release dashboard around ownership.
6. Verify anonymous catalog access, authenticated project isolation, publishing,
   duplicate-version rejection, and archive checksum parity.
7. Remove direct Hub Neon dependencies only after production parity and rollback
   checks pass.

Do not move E-Teyvat’s provider data into Supabase as part of this pivot.
