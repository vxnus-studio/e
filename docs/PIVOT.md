# E Pivot: Siduri Knowledge Interoperability

**Decision:** E is pivoting from a generic knowledge database runtime into a
portable knowledge-pack and provider contract for Siduri.

## Why this change

E-Teyvat demonstrated that PostgreSQL already provides a strong persistence
layer for the knowledge primitives. Its application code owns the useful
domain behavior, while the generic E database engines add little value and
are often bypassed.

Siduri's actual need is different: Siduri is a persistent AI runtime with
knowledge as one replaceable organ. Knowledge should provide grounded facts,
source attribution, and revision information to the brain. Publishers should
be able to make knowledge available to Siduri without implementing a custom
Siduri integration for every instance.

## Target architecture

```text
knowledge publisher
        |
        | E-compatible pack or provider
        v
Siduri Knowledge Hub
        |
        | KnowledgeOrgan
        v
Siduri runtime and Brain
```

Siduri owns installation, lifecycle, permissions, local storage, and organ
composition. E defines the compatibility boundary for factual knowledge.

## What E standardizes

The minimum contract should cover:

- pack identity, publisher, version, and schema version;
- source and license metadata;
- documents or chunks of factual content;
- stable identifiers and revisions;
- provenance and citations;
- retrieval requests and grounded results;
- capability declarations;
- optional entities, aliases, relations, and embeddings.

The contract should be strict at the boundary and easy to implement internally.
A publisher may keep any internal database or indexing system and expose E
through an adapter, export a portable pack, or use the reference schema
directly.

## What E does not standardize

E does not require:

- PostgreSQL, SQLite, or any particular database;
- a connection pool or ORM;
- a universal graph traversal engine;
- a web framework or deployment model;
- Teyvat, company, wiki, or corpus-specific fields;
- Siduri memory, personality, behavior, or orchestration.

Knowledge is distinct from companion memory:

```text
Knowledge: published, versioned, cited external facts
Memory:    personal, mutable, scoped companion state
```

## Siduri relationship

Siduri's `KnowledgeOrgan` is the local runtime interface. An E-compatible
provider or installed pack is adapted into that interface. Siduri may also
support non-E integrations in the future, but E is the guaranteed contract for
knowledge installed through the official Knowledge Hub.

```text
E protocol      = portable knowledge compatibility
KnowledgeOrgan  = Siduri runtime dependency injection
Knowledge Hub   = install, update, scope, and lifecycle management
```

## Status of the existing engines

`@vxnus/e-postgres`, `@vxnus/e-sqlite`, and `InMemoryEngine` are historical
reference implementations of the earlier design. They are not required for an
E-compatible publisher and should not define the future architecture.

The next implementation focus is the pack manifest, portable export format,
retrieval response, capability negotiation, and conformance fixtures. Storage
adapters may remain available for experimentation, but they are no longer the
center of E.

## Product principle

> Publish knowledge once. Install it into any Siduri instance. Keep the
> publisher's internal storage independent.

