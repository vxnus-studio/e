# Cross-Backend Parity Matrix (Phase 3 Update)

This document tracks behavioral parity across all three supported backends: **InMemoryEngine**, **SqliteEngine**, and **PostgresEngine**.

---

## 1. Feature & Persistence Parity Matrix

| Feature / Capability | Contract Requirement | InMemoryEngine | SqliteEngine | PostgresEngine | Parity Status |
|---|---|---|---|---|---|
| **Capabilities Query** | Report supported features | Exact Match | Exact Match | Exact Match | FULL PARITY |
| **`getEntity`** | By exact ID | Supported | Supported | Supported | FULL PARITY |
| **`resolve`** | Case-sensitive alias lookup | Supported | Supported | Supported | FULL PARITY |
| **`findRelations`** | Subject / Object / Predicate | Hydrates entities | Hydrates entities | Hydrates entities | FULL PARITY |
| **`findClaims`** | Entity claims | Supported | Supported | Supported | FULL PARITY |
| **`findDocuments`** | Entity documents | Supported | Supported | Supported | FULL PARITY |
| **`search` (ASCII)** | Lexical case-insensitive | Supported | Supported | Supported | FULL PARITY |
| **`search` (Wildcards `%` / `_`)** | Literal character escaping | Supported | Supported | Supported | FULL PARITY |
| **`search` (Unicode Case)** | Non-ASCII case folding | Full Unicode (`toLowerCase()`) | ASCII-only (`LIKE`) | Full Unicode (`ILIKE`) | **DOCUMENTED DIVERGENCE** (SQLite limitation) |
| **`search` (Pagination Order)** | Deterministic sort by ID | JavaScript UTF-16 code units | SQLite `BINARY` UTF-8 bytes | Postgres `COLLATE "C"` UTF-8 bytes | **DIVERGES ON NON-BMP** |
| **`traverse` (Bounds)** | Hard limit on paths & depth | Bounded | Bounded (SQL Predicate & Limit) | Bounded (SQL Predicate & Limit) | FULL PARITY |
| **`traverse` (Cycles)** | Prevent repeating edge in path | Prevented | Prevented | Prevented | FULL PARITY |
| **`traverse` (Ordering)** | Deterministic path sort | Identical | Identical | Identical | FULL PARITY |
| **`traverse` (Validation Ordering)** | Parameter validation before lookup | Evaluated 1st | Evaluated 1st | Evaluated 1st | FULL PARITY |
| **Primary Key Uniqueness** | Reject duplicate IDs on insert | Enforced (`ConstraintError`) | Enforced (`ConstraintError`) | Enforced (`ConstraintError`) | FULL PARITY |
| **Foreign Key Integrity** | Reject orphan aliases/relations | Enforced (`ConstraintError`) | Enforced (`ConstraintError`) | Enforced (`ConstraintError`) | FULL PARITY |
| **Metadata Persistence** | Persist provenance/temporal/identities/metadata | In-Memory (Cloned) | Persisted (JSON Text) | Persisted (JSONB) | **FULL PARITY (Canonical JSON)** |
| **Object Isolation** | Mutating input/result does not mutate DB | Fully Isolated (`cloneValue`) | Fully Isolated (Materialized) | Fully Isolated (Materialized) | FULL PARITY |
| **Batch Transactions** | Atomic multi-item insert | Transactional (Rollback) | Transactional (BEGIN/COMMIT) | Transactional (BEGIN/COMMIT) | FULL PARITY |

---

## 2. Intentional & Structural Differences

1. **SQLite Unicode Case Folding in `LIKE`**:
   - Standard SQLite `LIKE` operator is case-insensitive for ASCII characters only (`a-z` == `A-Z`). Accented characters such as `É` vs `é` are not folded without custom extensions.
   - Postgres `ILIKE` and JavaScript `String.prototype.toLowerCase()` perform full Unicode case-folding.
   - *Status*: Documented as an intentional backend platform constraint.
2. **String Collation on Astral Plane (Non-BMP)**:
   - JavaScript sorts characters using UTF-16 code unit values (`<`), which splits surrogate pairs.
   - PostgreSQL (`COLLATE "C"`) and SQLite (`BINARY`) sort by raw UTF-8 byte sequences.
   - Strings with standard ASCII and BMP characters sort identically across all backends. Surrogate pair characters (e.g. emoji) can diverge in sort order.
