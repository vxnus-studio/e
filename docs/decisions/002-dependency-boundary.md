# ADR 002: Strict Dependency Boundary

## Context
During Phase 2, we evaluated whether E should provide built-in Postgres adapters, HTTP servers, or domain schemas (like Teyvat) to accelerate the development of `e-teyvat`.

## Decision
E Core will remain purely a contract layer with an in-memory reference implementation. It will have zero dependencies on storage engines (Neon, Drizzle), web frameworks (Next.js, Express), transport protocols (MCP), or domain projects (`e-teyvat`).

## Consequences
- `e` is highly stable and lightweight.
- Projects implementing `e` (like `e-teyvat`) must build their own storage adapters that conform to the `EQueryEngine` interface.
- This guarantees `e` can be repurposed for entirely different domains (e.g. software architecture mapping) without dragging along Genshin-specific logic or heavy database clients.
