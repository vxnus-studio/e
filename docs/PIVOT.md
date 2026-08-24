# E Pivot: Siduri Knowledge Interoperability

**Decision:** E is pivoting from a generic knowledge database runtime into a
portable knowledge-pack and provider contract for Siduri.

## Why this change

The useful boundary is the knowledge pack and provider, not a shared storage
engine. Publishers should keep control of their content pipeline while Siduri
gets one predictable way to discover and consume knowledge.

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

## Siduri CLI example

An E-compatible pack should make knowledge setup part of normal companion
creation rather than a bespoke integration project:

```text
$ npx @vxnus/siduri create

Companion name? Siduri

[Knowledge]
Search the Knowledge Hub or enter a pack ID:
  09AXHFS  e-teyvat
           Genshin Impact database

Install this knowledge base? yes
Where should it run? local
Pack source? Local archive or hosted provider

[Vision]
Provider? Multimodal

[Voice]
Provider? VoiceVOX

[Brain]
Provider? ChatGPT
Model? gpt-5.6-luna

Creating Siduri...
Installing e-teyvat revision 5a805b7a...
Knowledge ready: 8,696 entities, 14,244 relations
Siduri is ready.
```

The same pack may instead be configured as a remote provider:

```text
Install locally? no
Remote knowledge URL? https://knowledge.example.com/e-teyvat
```

In both cases Siduri consumes the same E contract. The publisher does not
need to share its internal storage; it only provides an E-compatible export or
provider endpoint.

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

- any particular database or storage engine;
- a connection pool, ORM, or generic query runtime;
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

## Implementation status

The contract package now contains only the portable manifest, content,
revision, capability, and retrieval types. Pack storage, transport, indexing,
and lifecycle remain implementation concerns for publishers and Siduri.

## Product principle

> Publish knowledge once. Install it into any Siduri instance. Keep the
> publisher's internal storage independent.
