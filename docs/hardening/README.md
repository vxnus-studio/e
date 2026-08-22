# E Runtime Hardening Documentation

Welcome to the E Runtime Hardening documentation repository.

This directory maintains the source of truth regarding the stability, contract correctness, parity guarantees, and verification suites for the `@vxnus/e` knowledge runtime.

## Documentation Index

- **[AUDIT.md](./AUDIT.md)**: Phase 0 Baseline Forensic Audit findings and severity matrix.
- **[ROADMAP.md](./ROADMAP.md)**: Phased execution plan from Phase 0 to Phase 9.
- **[CONTRACT.md](./CONTRACT.md)**: Canonical semantic specification for all operations and constraints.
- **[PARITY.md](./PARITY.md)**: Feature and behavioral parity across InMemory, SQLite, and PostgreSQL.
- **[TESTING.md](./TESTING.md)**: Testing strategy, differential harness details, and false-confidence audit.
- **[CHANGELOG.md](./CHANGELOG.md)**: Chronological record of hardening changes and findings.

---

## Operating Rule

Treat E as potentially incorrect even when existing tests pass. Every phase adheres to strict exit criteria and requires explicit documentation updates before moving forward.
