# E Core Migration Guide

This document explains how to upgrade existing databases to support the new `E` core capabilities (provenance, temporal, identities).

## Migrating from Schema V1

The initial release of the generic schema did not support nested knowledge mapping on relations or claims natively. The v2 refactor introduces JSON extensions to these schemas.

### PostgreSQL
If you are running an existing PostgreSQL database backed by E, execute the migration located at `packages/postgres/migrations/001_add_provenance_and_identities.sql` to add `JSONB` support.

### SQLite
For SQLite backends, execute the migration script located at `packages/sqlite/migrations/001_add_provenance_and_identities.sql`.

## Test Environment Setup

### CI Postgres Testing
CI tests now provision a real PostgreSQL database instance automatically (via GitHub Actions `services`). Tests check `TEST_DATABASE_URL` during execution to bind to the test cluster.

### Local Development
If running tests locally, `better-sqlite3` will compile natively.
To run Postgres tests, spin up a local instance and set the env variable:

```bash
export TEST_DATABASE_URL="postgres://postgres@localhost/e_test"
npm run test
```
