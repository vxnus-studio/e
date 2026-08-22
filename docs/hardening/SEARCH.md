# E Core Search Semantics & Parity Specification

This document establishes the canonical search contract, query matching behavior, wildcard escaping, filter precedence, limit semantics, and backend boundaries across `@vxnus/e`, `@vxnus/e-sqlite`, and `@vxnus/e-postgres`.

---

## 1. Canonical Search Contract

Search queries are executed via `engine.query({ type: "search", search: SearchQuery })` and return matching entity records wrapped in `KnowledgeResult.search`.

### 1.1 Matching Mechanics
- **Matching Type**: Substring lexical matching (`name` or `slug`).
- **Fields Searched**: Matches if `entity.name` contains `query` OR `entity.slug` contains `query`.
- **Match Reason**: Tagged with `matchReason: "lexical"`.
- **Unsupported Modes**: `mode: "semantic"` and `mode: "hybrid"` are unsupported in core/base engines and throw `UnsupportedOperationError`.

### 1.2 Literal Wildcard & Escape Rules
SQL wildcards (`%` and `_`) and escape characters (`\`) are treated as **literal characters** across all engines:
```typescript
const escapedQuery = sq.query
  .replace(/\\/g, '\\\\')
  .replace(/%/g, '\\%')
  .replace(/_/g, '\\_');
```
A search for `"%"` only matches entities containing a literal `%` symbol (e.g. `"100% Discount"`).

---

## 2. Cross-Backend Parity Matrix

| Search Feature | InMemoryEngine | SqliteEngine | PostgresEngine | Parity Status |
|---|---|---|---|---|
| **ASCII Case Insensitivity** | `toLowerCase()` | `LIKE ... ESCAPE` | `ILIKE ... ESCAPE` | **FULL PARITY** |
| **Literal `%` Escaping** | `includes(q)` | `\%` ESCAPE | `\%` ESCAPE | **FULL PARITY** |
| **Literal `_` Escaping** | `includes(q)` | `\_` ESCAPE | `\_` ESCAPE | **FULL PARITY** |
| **Literal `\` Escaping** | `includes(q)` | `\\` ESCAPE | `\\` ESCAPE | **FULL PARITY** |
| **Namespace Filter** | Exact equality | `WHERE namespace = ?` | `WHERE namespace = $n` | **FULL PARITY** |
| **Kind Filter** | Exact equality | `WHERE kind = ?` | `WHERE kind = $n` | **FULL PARITY** |
| **Empty Query `""`** | Matches all filtered | Matches all filtered | Matches all filtered | **FULL PARITY** |
| **Limit = 0** | Returns `[]` | Returns `[]` | Returns `[]` | **FULL PARITY** |
| **Limit Clamping** | Max 10,000 | Max 10,000 | Max 10,000 | **FULL PARITY** |
| **Ordering** | Binary `id` ASC | `ORDER BY id COLLATE BINARY ASC` | `ORDER BY id COLLATE "C" ASC` | **FULL PARITY (BMP)** |
| **Unicode Case Folding** | Full Unicode (`toLowerCase`) | **ASCII-only** (Standard SQLite `LIKE`) | Full Unicode (`ILIKE`) | **DOCUMENTED PLATFORM LIMIT** |
| **CJK / Emoji Non-BMP** | Full Substring | Full Substring | Full Substring | **FULL PARITY** |

---

## 3. SQLite Unicode Platform Limitation

Standard SQLite `LIKE` operator is case-insensitive for ASCII characters (`a-z` == `A-Z`) only. In standard SQLite without ICU extension, accented character casing (e.g. `café` vs `CAFÉ`) does not fold.
- **Contract Rule**: Search in SQLite performs case-insensitive ASCII search and exact-case Unicode search.
