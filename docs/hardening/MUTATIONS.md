# E Core Mutation Model Specification

This document details the mutation primitives, foreign key cascading behavior, and data dependency rules.

---

## 1. Mutation Primitives & Foreign Key Rules

| Primitive | Target Table / Map | Foreign Key Invariants | Delete Cascade Behavior |
|---|---|---|---|
| `insertEntity(e)` | `e_entities` | Primary ID uniqueness | Root node deletion cascades to aliases, relations, claims, documents |
| `insertAlias(a)` | `e_aliases` | `entityId` must reference existing `Entity` | Cascades on parent Entity deletion |
| `insertRelation(r)` | `e_relations` | `subjectId` and `objectId` must exist | Cascades on subject or object Entity deletion |
| `insertClaim(c)` | `e_claims` | `entityId` must reference existing `Entity` | Cascades on parent Entity deletion |
| `insertDocument(d)` | `e_documents` | `entityId` must reference existing `Entity` | Cascades on parent Entity deletion |

---

## 2. Ingestion Ordering Rules
When inserting related data graphs, callers MUST supply records in dependency topological order:
1. `Entity` records must be inserted prior to referencing `Alias`, `Claim`, `Document`, or `Relation` records.
2. Both `subjectId` and `objectId` entities must be inserted prior to `Relation` creation.
