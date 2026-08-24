# Phase 6 handoff — publisher adoption and E release

**Phase:** 6 — publisher adoption and release
**Status:** complete

## Delivered

- Added the publisher guide and release checklist.
- Added the `e-knowledge-validate` pack validation CLI.
- Added semantic-profile conformance fixtures, including rejection of enabled
  semantic search without model metadata.
- Confirmed npm serves `0.1.2` as the current release.
- Prepared patch release `0.1.2` for the changed protocol and knowledge
  packages.
- Published both changed packages with an interactive npm OTP.

## Verification

- Run authenticated and anonymous publisher checks on the deployed Hub.
- Verify archive checksum parity, duplicate-version handling, and cleanup
  after failed persistence.
- Confirm a publisher can discover and install a pack through the catalog.

Production catalog discovery and the Hub-to-Teyvat provider smoke check pass.

The publisher workflow remains in the Hub application; protocol and local pack
validation remain in E packages.
