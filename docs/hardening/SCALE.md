# E Runtime Scale Specification (Phase 11 Update)

This document establishes the complexity and resource consumption bounds for the E runtime.

---

## 1. Operation Complexity Matrix

| Operation | InMemory Time | InMemory Mem | SQLite Time | PostgreSQL Time | DB Round Trips | Index Used |
|---|---|---|---|---|---|---|
| **`getEntity`** | $O(1)$ | $O(1)$ | $O(\log N)$ | $O(\log N)$ | 1 | `e_entities_pkey` |
| **`resolve`** | $O(A)$ | $O(R)$ | $O(\log N)$ | $O(\log N)$ | 1 | `idx_e_aliases_alias` |
| **`search`** | $O(N)$ candidate scan for substring semantics | $O(\text{limit})$ plus match scan | $O(N)$ worst case | $O(N)$ worst case | 1 | No guaranteed index for leading-wildcard substring |
| **`findRelations`** | $O(R)$ | $O(R)$ | $O(\log N)$ | $O(\log N)$ | 1-2 | `idx_e_relations_subject_id` |
| **`findClaims`** | $O(C)$ | $O(C)$ | $O(\log N)$ | $O(\log N)$ | 1 | `idx_e_claims_entity_id` |
| **`findDocuments`**| $O(D)$ | $O(D)$ | $O(\log N)$ | $O(\log N)$ | 1 | `idx_e_documents_entity_id` |
| **`traverse`** | $O(\min(\|V\|+\|E\|, M \cdot d))$ | $O(M \cdot d)$ bounded by path/frontier limits | Per-frontier relation lookup plus bounded hydration chunks | One set-based frontier relation query plus bounded hydration per level | 1 start lookup + 1 relation query + hydration query per level | `idx_e_relations_subject_id`, `idx_e_relations_object_id` |
| **`ingestBatch`** | $O(B)$ | $O(B)$ snapshot overhead | $O(B)$ prepared-statement executions in one transaction | $O(B)$ SQL round trips in one transaction | PostgreSQL: one per record plus transaction statements | Primary keys and foreign keys |

---

## 2. Resource Bounding Summary

- **Intermediate BFS Expansion**: Strict $O(\text{maxPaths})$ frontier boundary prevents memory spikes.
- **SQLite Parameter Chunking**: Batches bounded to 500 parameters per SQL chunk to avoid SQLite variable limit exceptions.
- **PostgreSQL Connection Pool**: `pool.query()` and batch `finally` release clients, but pool exhaustion and timeout behavior still require live-database measurement.

## 3. Intended scale envelope

- **1k entities/relations**: covered by the existing local scale suite; expected to be practical for all local engines.
- **100k entities**: not a production claim. Point lookup remains index-backed in SQL, but lexical search and bulk ingestion require linear work; PostgreSQL batch ingestion also incurs one round trip per record.
- **1m entities**: outside the verified envelope. Search, unpaginated in-memory scans, hydration, and per-record batch writes require a deliberate scale redesign and live query-plan measurements.
- **Result limits**: relation/evidence/search output is bounded by default and caller limits; traversal bounds expansion and hydration, but offsetless pagination is not implemented.
