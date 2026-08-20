# E Architecture Invariants

This document outlines the strict rules that govern the `E` architecture. Future contributors must not break these rules. If an implementation requires breaking an invariant, the implementation is incorrect, or the architecture requires a formal revision via an ADR.

### Invariant 1: E Core Contains No Domain-Specific Knowledge
The core package (`e`) must not contain types, schemas, or logic specific to Teyvat, Schale, or any other universe/domain. Domain logic belongs exclusively in implementations (e.g. `e-teyvat`).

### Invariant 2: E Core Does Not Depend on Domain Implementations
E must never import from or depend on `e-teyvat`, `siduri`, or any other consumer. The relationship is strictly unidirectional: domains implement E.

### Invariant 3: The Query Contract is Transport-Independent
The `EQueryEngine` and `QueryRequest` intents must remain serializable and conceptually identical whether queried via direct library import, HTTP API, or MCP Server. E Core does not implement HTTP or MCP itself; these are transport adapters.

### Invariant 4: The Result Contract is Storage-Independent
`KnowledgeResult` returns hydrated graphs of knowledge (entities, relations, claims) and metadata. It must never leak implementation details such as SQL row formats, vector database scores, or ORM models.

### Invariant 5: Domain Implementations Depend on E, Never the Reverse
A project like `e-teyvat` is free to use Postgres, custom tables (e.g., `banner_phases`), and domain rules, but E itself must never be updated merely to accommodate a limitation or feature of `e-teyvat` unless it is a generic knowledge layer feature.

### Invariant 6: E Core Must Remain Usable Without a Database
E defines the *contract*. The provided `InMemoryEngine` proves this contract can be satisfied without external dependencies. Storage is always injected via an implementation of `EQueryEngine`.

### Invariant 7: E Core Must Remain Usable Without HTTP or MCP
Transports are built *around* E, not *within* E. E must function completely as a local library.

### Invariant 8: Siduri is a Consumer of E, Not Part of E
Siduri consumes `EQueryEngine` (or its HTTP/MCP projection). E does not have specific features designed "only for Siduri". E is a general-purpose AI knowledge architecture.
