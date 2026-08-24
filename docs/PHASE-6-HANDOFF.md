# Phase 6 handoff — publisher adoption and E release

**Phase:** 6 — publisher adoption and release
**Status:** patch release prepared; npm publish pending OTP; production
verification pending

## Delivered

- Added the publisher guide and release checklist.
- Added the `e-knowledge-validate` pack validation CLI.
- Added semantic-profile conformance fixtures, including rejection of enabled
  semantic search without model metadata.
- Confirmed npm currently serves `0.1.1` as the previous release.
- Prepared patch release `0.1.2` for the changed protocol and knowledge
  packages.
- Confirmed npm authentication reaches the publisher account, but publishing
  requires an interactive one-time password (`EOTP`).

## Remaining production gate

- Run authenticated and anonymous publisher checks on the deployed Hub.
- Verify archive checksum parity, duplicate-version handling, and cleanup
  after failed persistence.
- Confirm a publisher can discover and install a pack through the catalog.

To continue the package release, run `npm publish --access public` from each
changed package with an OTP-capable npm session. No package was published by
the failed non-interactive attempt.

The publisher workflow remains in the Hub application; protocol and local pack
validation remain in E packages.
