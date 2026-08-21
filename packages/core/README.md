# e-*

> One schema to structure them all 🌐

## What is "e-"?

`e-` is a naming prefix for an idea, not a finished product yet. It's the concept behind projects like **e-Teyvat** (Genshin Impact) and **e-Schale** (Blue Archive) — taking a universe's lore and turning it into a structured, queryable knowledge graph instead of a wall of wiki text.

This README is just introducing what "e-" *means*. Nothing here is done — think of it as the concept doc before the build.

## The origin idea

It started as wanting to **unify fictional universes** under one schema — same shape of data for characters, items, locations, events — so an AI could retrieve facts across different "-verses" consistently. Ask about a character in Teyvat or a student in Kivotos, get an answer built the same way underneath. 🎮✨

## Where the idea is heading

The scope has since shifted. It's no longer just "make anime universes consistent" — the real idea is:

> **A standardized, schema/architecture-first knowledge base that anything can be injected into.**

Meaning the core isn't really about Genshin or Blue Archive — those are just fun proving grounds for the idea. What actually matters is the **schema itself**: a general-purpose knowledge architecture that could, in theory, ingest *any* domain —

- 🎮 Fictional universes (games, anime, novels)
- 🏢 Company / institutional docs
- 📚 Internal wikis, SOPs, product knowledge
- 🧩 Anything with entities + relations + facts

The goal: consistent structure in → consistent, graph-backed AI retrieval out, regardless of what the source content actually is.

## Design principles (the intent, so far)

- **Schema-first** — define the shape once, plug in different data.
- **Entity + relation modeling** — everything is a node with attributes and edges, not free text.
- **AI-retrievable by default** — structure exists so retrieval is exact, with traceable graph evidence, not vibes-based RAG guessing.
- **Domain-agnostic** — a "character" and an "employee" and a "product" should be able to live in the same underlying architecture.

## Packages

E is distributed as a monorepo with multiple packages:

- `e`: The core types and in-memory engine.
- `@e/sqlite`: The SQLite persistence engine.
- `@e/postgres`: The PostgreSQL persistence engine.

Since these are currently internal/workspace packages, you can use them within this repository's workspace, or if published, install them via npm:

```bash
# To install the core interface
npm install e
# To install a persistence backend
npm install @e/sqlite
```

## Basic Usage

The package exposes the core types and an `InMemoryEngine` for testing.

```typescript
import { InMemoryEngine } from "e";
import type { QueryRequest } from "e";

const engine = new InMemoryEngine();

// Finding relations (both directions supported)
const result = await engine.query({ 
  type: "findRelations", 
  subjectId: "char_1" 
});

const reverseResult = await engine.query({ 
  type: "findRelations", 
  objectId: "item_1",
  predicate: "drops_from"
});
```

See the `docs/` folder for architectural guidelines, such as `HYDRATION_AND_ERRORS.md` which formalizes the guarantees an `EQueryEngine` must provide.

---

*This is just the intro. Nothing's built out under this framing yet — more to come as the schema takes shape.*
