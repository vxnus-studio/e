# Traversal & Database Scale Specification (Phase 8 Update)

This document establishes the complexity and resource consumption bounds for the E runtime.

---

## 1. Operation Complexity Matrix

| Operation | InMemory Time | InMemory Mem | SQLite Time | PostgreSQL Time | DB Round Trips | Index Used |
|---|---|---|---|---|---|---|
| **`getEntity`** | $O(1)$ | $O(1)$ | $O(\log N)$ | $O(\log N)$ | 1 | `e_entities_pkey` |
| **`resolve`** | $O(A)$ | $O(R)$ | $O(\log N)$ | $O(\log N)$ | 1 | `idx_e_aliases_alias` |
| **`search`** | $O(N)$ | $O(\text{limit})$ | $O(N)$ | $O(N)$ | 1 | `idx_e_entities_namespace` |
| **`findRelations`** | $O(R)$ | $O(R)$ | $O(\log N)$ | $O(\log N)$ | 1-2 | `idx_e_relations_subject_id` |
| **`findClaims`** | $O(C)$ | $O(C)$ | $O(\log N)$ | $O(\log N)$ | 1 | `idx_e_claims_entity_id` |
| **`findDocuments`**| $O(D)$ | $O(D)$ | $O(\log N)$ | $O(\log N)$ | 1 | `idx_e_documents_entity_id` |
| **`traverse`** | $O(\min(\|V\|+\|E\|, M \cdot d))$ | $O(M \cdot d)$ | $O(d \cdot \log N)$ | $O(d \cdot \log N)$ | $1-2$ per level | `idx_e_relations_*` |

---

## 2. Resource Bounding Summary

- **Intermediate BFS Expansion**: Strict $O(\text{maxPaths})$ frontier boundary prevents memory spikes.
- **SQLite Parameter Chunking**: Batches bounded to 500 parameters per SQL chunk to avoid SQLite variable limit exceptions.
- **PostgreSQL Connection Pool**: Automatic client acquisition and return lifecycle prevents connection leakage under heavy concurrency.
