# Knowledge Model

E utilizes a minimalistic core model to represent knowledge across any domain.

## Canonical Primitives

1. **Entity**
   - **Purpose:** A distinctly identifiable concept (e.g., a person, a place, a software service).
   - **Identity:** `id` (globally unique), scoped conceptually by a `namespace`.
   - **Properties:** `kind`, `slug`, `name`, `data` (domain-specific attributes).

2. **Alias**
   - **Purpose:** Allows resolving entities by alternative names or identifiers.
   - **Identity:** Bound to an `entityId`.

3. **Relation**
   - **Purpose:** A directed edge between two entities.
   - **Properties:** `subjectId`, `predicate`, `objectId`.

4. **Claim (and Evidence)**
   - **Purpose:** Decouples subjective or evolving facts from the core entity.
   - **Properties:** `entityId`, `statement`, `confidence`, `source`. E does not assert universal truth; it asserts that a source made a claim.

5. **Document**
   - **Purpose:** Long-form text attached to an entity, intended for semantic retrieval (RAG).

## Claims vs. Facts

In E, we do not use the word "Fact" as a primitive. Every piece of debatable or lore-based knowledge is a **Claim**. This allows conflicting information from different sources (e.g., beta game data vs. live game data) to coexist without corrupting the graph.
