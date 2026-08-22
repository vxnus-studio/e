# E Runtime Hardening Roadmap

This roadmap defines the phase-by-phase execution plan for hardening E before it serves as the knowledge runtime backend for other projects.

```mermaid
gantt
    title E Hardening Phases
    dateFormat  X
    axisFormat %s
    section Audit
    Phase 0: Forensic Audit & Baseline :active, p0, 0, 1
    section Contract & Testing
    Phase 1: Test Infra & Contract Truth :p1, 1, 2
    Phase 2: Core Contract & Error Semantics :p2, 2, 3
    section Engine & Storage
    Phase 3: Persistence Correctness :p3, 3, 4
    Phase 4: Traversal Hardening :p4, 4, 5
    Phase 5: Search & Resolution Hardening :p5, 5, 6
    section Reliability & Scale
    Phase 6: Transactions & Mutation Safety :p6, 6, 7
    Phase 7: Schema & Migration Hardening :p7, 7, 8
    Phase 8: Scale & Concurrency :p8, 8, 9
    Phase 9: Final Hardening Review :p9, 9, 10
```

---

## Phases Overview

### [Phase 0 — Baseline / Forensic Audit](./AUDIT.md)
- **Goal**: Full discovery, field tracking, finding catalog, false confidence test identification.
- **Status**: Completed. No code changes.

### [Phase 1 — Test Infrastructure and Contract Truth](./TESTING.md)
- **Goal**: Eliminate false confidence in test suites before changing implementation code.
- **Key Tasks**:
  - Fix Postgres test delegation bug in `differential.test.ts`.
  - Replace `console.log` with strict assertions in `search_audit*.test.ts`.
  - Add multi-backend differential suites for metadata round-tripping.

### [Phase 2 — Core Contract + Error Semantics](./ERRORS.md)
- **Goal**: Predictable, normalized error semantics across InMemory, SQLite, and PostgreSQL.
- **Key Tasks**:
  - Unify validation logic for `QueryRequest` and `SearchQuery`.
  - Standardize error classes (`ConstraintError`, `QueryError`, `UnsupportedOperationError`).
  - Eliminate database-driver-specific error leaks.

### [Phase 3 — Persistence Correctness](./PERSISTENCE.md)
- **Goal**: Guarantee zero data loss for all first-class data and metadata fields across backends.
- **Key Tasks**:
  - Persist `identities`, `provenance`, `temporal`, and `metadata` in SQLite and Postgres `INSERT` statements.
  - Implement snapshotting/deep-cloning in `InMemoryEngine`.
  - Round-trip validation tests for all entity and relation types.

### [Phase 4 — Traversal Hardening](./TRAVERSAL.md)
- **Goal**: Safe, deterministic, bounded graph traversal resilient to adversarial topologies.
- **Key Tasks**:
  - Bound intermediate candidate frontier expansion strictly to prevent memory explosion.
  - Verify cycle handling, fan-in/fan-out, self-loops, and exact partial results.

### [Phase 5 — Search + Resolution Hardening](./SEARCH.md)
- **Goal**: Explicit, portable lexical search and resolution semantics.
- **Key Tasks**:
  - Align case folding rules, wildcard escaping, and deterministic pagination ordering.
  - Formally specify `IdentityMapping` semantics.

### [Phase 6 — Transactions / Mutation Safety](./CONCURRENCY.md)
- **Goal**: Safe bulk mutation abstraction with atomic transaction boundaries.
- **Key Tasks**:
  - Design and implement atomic batch mutations with rollback.
  - Test concurrent mutations and failure recovery.

### [Phase 7 — Schema + Migration Hardening](./PERSISTENCE.md)
- **Goal**: Trustworthy installation and schema upgrade paths.
- **Key Tasks**:
  - Add schema equivalence validation (`fresh schema == base + migrations`).
  - Verify indexes, cascade deletions, and constraints.

### [Phase 8 — Scale / Performance / Concurrency](./SCALE.md)
- **Goal**: Measure practical runtime bounds and concurrency characteristics under stress.
- **Key Tasks**:
  - Scale tests for 1k–100k entities and relations.
  - Concurrency tests for parallel reads, writes, and traversal.

### [Phase 9 — Traversal Safety & Atomic Batch Ingestion](./PHASE-9.md)
- **Goal**: Harden intermediate traversal candidate expansion/hydration and establish atomic multi-record batch ingestion with rollback across all engines.
- **Status**: Completed. Resolved P0-1 (traversal resource safety) and P0-2 (transactional batch ingestion).
