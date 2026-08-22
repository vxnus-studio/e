import { ConstraintError, QueryError, UnsupportedOperationError } from "./errors.js";
import type {
  Entity,
  Alias,
  Relation,
  Claim,
  Document,
  Provenance,
  TemporalSemantics,
  IdentityMapping,
  BatchDataset,
  QueryRequest,
} from "./types.js";
import {
  MAX_STORAGE_IDENTIFIER_LENGTH,
  MAX_STORAGE_SHORT_TEXT_LENGTH,
  MAX_PROVENANCE_PROVIDER_LENGTH,
  MAX_PROVENANCE_SOURCE_LENGTH,
  MAX_PROVENANCE_SOURCE_ID_LENGTH,
  MAX_PROVENANCE_SOURCE_REVISION_LENGTH,
  MAX_PROVENANCE_LOCATOR_LENGTH,
  MAX_PROVENANCE_CONTENT_HASH_LENGTH,
  MAX_PROVENANCE_OBSERVED_AT_LENGTH,
  MAX_PROVENANCE_EXTRACTED_VIA_LENGTH,
  MAX_IDENTITY_EXTERNAL_ID_LENGTH,
  MAX_SAFE_BATCH_ITEMS,
  MAX_SAFE_JSON_DEPTH,
  MAX_SAFE_JSON_ARRAY_LENGTH,
  MAX_SAFE_JSON_OBJECT_KEYS,
  MAX_SAFE_JSON_STRING_LENGTH,
  MAX_SAFE_JSON_SERIALIZED_LENGTH,
  MAX_SAFE_IDENTITY_MAPPINGS,
  MAX_SAFE_PROVENANCE_LINEAGE,
} from "./types.js";

const VALID_CONFIDENCE_LEVELS = new Set(["canon", "theory", "outdated", "unverified"]);

function validateResultLimit(value: unknown): void {
  if (value !== undefined && (typeof value !== "number" || !Number.isInteger(value) || value < 0)) {
    throw new QueryError(`Invalid limit: ${value}`);
  }
}

function validateNonEmptyString(val: unknown, fieldName: string, maxLen: number = 1000): string {
  if (typeof val !== "string") {
    throw new ConstraintError(`Invalid ${fieldName}: must be a string`, undefined, "VALIDATION_ERROR");
  }
  const trimmed = val.trim();
  if (trimmed.length === 0) {
    throw new ConstraintError(`Invalid ${fieldName}: cannot be empty or whitespace-only`, undefined, "VALIDATION_ERROR");
  }
  if ([...val].length > maxLen) {
    throw new ConstraintError(`Invalid ${fieldName}: exceeds maximum allowed length of ${maxLen}`, undefined, "VALIDATION_ERROR");
  }
  return val;
}

function validateOptionalString(val: unknown, fieldName: string, maxLen: number = 10000): void {
  if (val === undefined || val === null) return;
  if (typeof val !== "string") {
    throw new ConstraintError(`Invalid ${fieldName}: must be a string`, undefined, "VALIDATION_ERROR");
  }
  if ([...val].length > maxLen) {
    throw new ConstraintError(`Invalid ${fieldName}: exceeds maximum allowed length of ${maxLen}`, undefined, "VALIDATION_ERROR");
  }
}

export function validateProvenance(prov: unknown): void {
  if (prov === undefined || prov === null) return;
  if (typeof prov !== "object" || Array.isArray(prov)) {
    throw new ConstraintError("Invalid provenance: must be an object", undefined, "VALIDATION_ERROR");
  }
  const p = prov as Record<string, unknown>;
  validateNonEmptyString(p.provider, "provenance.provider", MAX_PROVENANCE_PROVIDER_LENGTH);
  validateOptionalString(p.source, "provenance.source", MAX_PROVENANCE_SOURCE_LENGTH);
  validateOptionalString(p.sourceId, "provenance.sourceId", MAX_PROVENANCE_SOURCE_ID_LENGTH);
  validateOptionalString(p.sourceRevision, "provenance.sourceRevision", MAX_PROVENANCE_SOURCE_REVISION_LENGTH);
  validateOptionalString(p.locator, "provenance.locator", MAX_PROVENANCE_LOCATOR_LENGTH);
  validateOptionalString(p.contentHash, "provenance.contentHash", MAX_PROVENANCE_CONTENT_HASH_LENGTH);
  validateOptionalString(p.observedAt, "provenance.observedAt", MAX_PROVENANCE_OBSERVED_AT_LENGTH);
  validateOptionalString(p.extractedVia, "provenance.extractedVia", MAX_PROVENANCE_EXTRACTED_VIA_LENGTH);
  if (p.derivedFrom !== undefined && p.derivedFrom !== null) {
    if (!Array.isArray(p.derivedFrom)) {
      throw new ConstraintError("Invalid provenance.derivedFrom: must be an array of strings", undefined, "VALIDATION_ERROR");
    }
    if (p.derivedFrom.length > MAX_SAFE_PROVENANCE_LINEAGE) {
      throw new ConstraintError(`Invalid provenance.derivedFrom: exceeds maximum allowed length of ${MAX_SAFE_PROVENANCE_LINEAGE}`, undefined, "VALIDATION_ERROR");
    }
    for (const item of p.derivedFrom) {
      if (typeof item !== "string") {
        throw new ConstraintError("Invalid provenance.derivedFrom element: must be a string", undefined, "VALIDATION_ERROR");
      }
      validateOptionalString(item, "provenance.derivedFrom element", MAX_STORAGE_IDENTIFIER_LENGTH);
    }
  }
}

export function validateTemporal(temp: unknown): void {
  if (temp === undefined || temp === null) return;
  if (typeof temp !== "object" || Array.isArray(temp)) {
    throw new ConstraintError("Invalid temporal: must be an object", undefined, "VALIDATION_ERROR");
  }
  const t = temp as Record<string, unknown>;
  validateOptionalString(t.observedAt, "temporal.observedAt", 100);
  validateOptionalString(t.publishedAt, "temporal.publishedAt", 100);
  validateOptionalString(t.validFrom, "temporal.validFrom", 100);
  validateOptionalString(t.validUntil, "temporal.validUntil", 100);
}

export function validateIdentities(identities: unknown): void {
  if (identities === undefined || identities === null) return;
  if (!Array.isArray(identities)) {
    throw new ConstraintError("Invalid identities: must be an array", undefined, "VALIDATION_ERROR");
  }
  if (identities.length > MAX_SAFE_IDENTITY_MAPPINGS) {
    throw new ConstraintError(`Invalid identities: exceeds maximum allowed length of ${MAX_SAFE_IDENTITY_MAPPINGS}`, undefined, "VALIDATION_ERROR");
  }
  for (const idm of identities) {
    if (!idm || typeof idm !== "object" || Array.isArray(idm)) {
      throw new ConstraintError("Invalid identity mapping: must be an object", undefined, "VALIDATION_ERROR");
    }
    validateNonEmptyString((idm as any).provider, "identity.provider", MAX_PROVENANCE_PROVIDER_LENGTH);
    validateNonEmptyString((idm as any).externalId, "identity.externalId", MAX_IDENTITY_EXTERNAL_ID_LENGTH);
  }
}

export function validateCanonicalJson(
  val: unknown,
  fieldName: string,
  seen: Set<unknown> = new Set()
): void {
  type Frame = { value: unknown; path: string; depth: number; exit?: boolean };
  const stack: Frame[] = [{ value: val, path: fieldName, depth: 0 }];
  const active = seen;

  while (stack.length > 0) {
    const frame = stack.pop()!;
    if (frame.exit) {
      active.delete(frame.value);
      continue;
    }
    const current = frame.value;
    if (current === null || typeof current === "boolean") continue;
    if (typeof current === "string") {
      if ([...current].length > MAX_SAFE_JSON_STRING_LENGTH) {
        throw new ConstraintError(`Invalid ${frame.path}: string exceeds maximum allowed length of ${MAX_SAFE_JSON_STRING_LENGTH}`, undefined, "VALIDATION_ERROR");
      }
      continue;
    }
    if (typeof current === "number") {
      if (!Number.isFinite(current)) {
        throw new ConstraintError(`Invalid ${frame.path}: number values must be finite (received ${current})`, undefined, "VALIDATION_ERROR");
      }
      continue;
    }
    if (typeof current === "undefined" || typeof current === "bigint" || typeof current === "symbol" || typeof current === "function") {
      throw new ConstraintError(`Invalid ${frame.path}: type '${typeof current}' is not supported in canonical JSON`, undefined, "VALIDATION_ERROR");
    }
    if (frame.depth > MAX_SAFE_JSON_DEPTH) {
      throw new ConstraintError(`Invalid ${frame.path}: nesting exceeds maximum depth of ${MAX_SAFE_JSON_DEPTH}`, undefined, "VALIDATION_ERROR");
    }
    if (active.has(current)) {
      throw new ConstraintError(`Invalid ${frame.path}: cyclic structures are not allowed`, undefined, "VALIDATION_ERROR");
    }
    active.add(current);
    stack.push({ value: current, path: frame.path, depth: frame.depth, exit: true });

    if (Array.isArray(current)) {
      if (current.length > MAX_SAFE_JSON_ARRAY_LENGTH) {
        throw new ConstraintError(`Invalid ${frame.path}: array exceeds maximum allowed length of ${MAX_SAFE_JSON_ARRAY_LENGTH}`, undefined, "VALIDATION_ERROR");
      }
      for (let i = current.length - 1; i >= 0; i--) {
        stack.push({ value: current[i], path: `${frame.path}[${i}]`, depth: frame.depth + 1 });
      }
      continue;
    }

    const obj = current as Record<string, unknown>;
    const proto = Object.getPrototypeOf(obj);
    if (proto !== null && proto !== Object.prototype) {
      const ctorName = (obj as any).constructor?.name || "non-plain object";
      throw new ConstraintError(`Invalid ${frame.path}: custom class or non-plain object instance (${ctorName}) is not allowed in canonical JSON`, undefined, "VALIDATION_ERROR");
    }
    const keys = Object.keys(obj);
    if (keys.length > MAX_SAFE_JSON_OBJECT_KEYS) {
      throw new ConstraintError(`Invalid ${frame.path}: object exceeds maximum key count of ${MAX_SAFE_JSON_OBJECT_KEYS}`, undefined, "VALIDATION_ERROR");
    }
    for (let i = keys.length - 1; i >= 0; i--) {
      const key = keys[i]!;
      if (obj[key] === undefined) {
        throw new ConstraintError(`Invalid ${frame.path}.${key}: undefined object properties are not allowed in canonical JSON`, undefined, "VALIDATION_ERROR");
      }
      stack.push({ value: obj[key], path: `${frame.path}.${key}`, depth: frame.depth + 1 });
    }
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(val);
  } catch (error) {
    throw new ConstraintError(`Invalid ${fieldName}: could not serialize canonical JSON`, error, "VALIDATION_ERROR");
  }
  if (serialized.length > MAX_SAFE_JSON_SERIALIZED_LENGTH) {
    throw new ConstraintError(`Invalid ${fieldName}: serialized JSON exceeds maximum length of ${MAX_SAFE_JSON_SERIALIZED_LENGTH}`, undefined, "VALIDATION_ERROR");
  }
}

export function validateEntity(entity: unknown): asserts entity is Entity {
  if (!entity || typeof entity !== "object" || Array.isArray(entity)) {
    throw new ConstraintError("Entity must be a non-null object", undefined, "VALIDATION_ERROR");
  }
  const e = entity as Record<string, unknown>;
  validateNonEmptyString(e.id, "entity.id", MAX_STORAGE_IDENTIFIER_LENGTH);
  validateNonEmptyString(e.namespace, "entity.namespace", MAX_STORAGE_SHORT_TEXT_LENGTH);
  validateNonEmptyString(e.kind, "entity.kind", MAX_STORAGE_SHORT_TEXT_LENGTH);
  validateNonEmptyString(e.slug, "entity.slug", MAX_STORAGE_SHORT_TEXT_LENGTH);
  validateNonEmptyString(e.name, "entity.name", MAX_STORAGE_SHORT_TEXT_LENGTH);

  if (e.data === undefined || typeof e.data !== "object" || e.data === null || Array.isArray(e.data)) {
    throw new ConstraintError("Invalid entity.data: must be a non-null object", undefined, "VALIDATION_ERROR");
  }
  validateCanonicalJson(e.data, "entity.data");

  validateIdentities(e.identities);
  validateProvenance(e.provenance);
  validateTemporal(e.temporal);
}

export function validateAlias(alias: unknown): asserts alias is Alias {
  if (!alias || typeof alias !== "object" || Array.isArray(alias)) {
    throw new ConstraintError("Alias must be a non-null object", undefined, "VALIDATION_ERROR");
  }
  const a = alias as Record<string, unknown>;
  validateNonEmptyString(a.id, "alias.id", MAX_STORAGE_IDENTIFIER_LENGTH);
  validateNonEmptyString(a.entityId, "alias.entityId", MAX_STORAGE_IDENTIFIER_LENGTH);
  validateNonEmptyString(a.alias, "alias.alias", MAX_STORAGE_SHORT_TEXT_LENGTH);
}

export function validateRelation(relation: unknown): asserts relation is Relation {
  if (!relation || typeof relation !== "object" || Array.isArray(relation)) {
    throw new ConstraintError("Relation must be a non-null object", undefined, "VALIDATION_ERROR");
  }
  const r = relation as Record<string, unknown>;
  validateNonEmptyString(r.id, "relation.id", MAX_STORAGE_IDENTIFIER_LENGTH);
  validateNonEmptyString(r.subjectId, "relation.subjectId", MAX_STORAGE_IDENTIFIER_LENGTH);
  validateNonEmptyString(r.predicate, "relation.predicate", MAX_STORAGE_SHORT_TEXT_LENGTH);
  validateNonEmptyString(r.objectId, "relation.objectId", MAX_STORAGE_IDENTIFIER_LENGTH);

  if (r.metadata !== undefined) {
    if (typeof r.metadata !== "object" || r.metadata === null || Array.isArray(r.metadata)) {
      throw new ConstraintError("Invalid relation.metadata: must be an object", undefined, "VALIDATION_ERROR");
    }
    validateCanonicalJson(r.metadata, "relation.metadata");
  }

  validateProvenance(r.provenance);
  validateTemporal(r.temporal);
}

export function validateClaim(claim: unknown): asserts claim is Claim {
  if (!claim || typeof claim !== "object" || Array.isArray(claim)) {
    throw new ConstraintError("Claim must be a non-null object", undefined, "VALIDATION_ERROR");
  }
  const c = claim as Record<string, unknown>;
  validateNonEmptyString(c.id, "claim.id", MAX_STORAGE_IDENTIFIER_LENGTH);
  validateNonEmptyString(c.entityId, "claim.entityId", MAX_STORAGE_IDENTIFIER_LENGTH);
  validateNonEmptyString(c.statement, "claim.statement", 100000);
  validateNonEmptyString(c.source, "claim.source", MAX_STORAGE_SHORT_TEXT_LENGTH);

  if (typeof c.confidence !== "string" || !VALID_CONFIDENCE_LEVELS.has(c.confidence)) {
    throw new ConstraintError(
      `Invalid claim.confidence '${c.confidence}': must be one of 'canon', 'theory', 'outdated', 'unverified'`,
      undefined,
      "VALIDATION_ERROR"
    );
  }

  validateProvenance(c.provenance);
  validateTemporal(c.temporal);
}

export function validateDocument(doc: unknown): asserts doc is Document {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    throw new ConstraintError("Document must be a non-null object", undefined, "VALIDATION_ERROR");
  }
  const d = doc as Record<string, unknown>;
  validateNonEmptyString(d.id, "document.id", MAX_STORAGE_IDENTIFIER_LENGTH);
  validateNonEmptyString(d.entityId, "document.entityId", MAX_STORAGE_IDENTIFIER_LENGTH);
  if (typeof d.content !== "string") {
    throw new ConstraintError("Invalid document.content: must be a string", undefined, "VALIDATION_ERROR");
  }

  validateProvenance(d.provenance);
}

export function validateBatchDataset(dataset: unknown): asserts dataset is BatchDataset {
  if (!dataset || typeof dataset !== "object" || Array.isArray(dataset)) {
    throw new ConstraintError("Batch dataset must be an object", undefined, "VALIDATION_ERROR");
  }
  const ds = dataset as Record<string, unknown>;
  const arrays = [ds.entities, ds.aliases, ds.relations, ds.claims, ds.documents];
  const itemCount = arrays.reduce<number>((count, value) => count + (Array.isArray(value) ? value.length : 0), 0);
  if (itemCount > MAX_SAFE_BATCH_ITEMS) {
    throw new ConstraintError(`Batch exceeds maximum item count of ${MAX_SAFE_BATCH_ITEMS}`, undefined, "BATCH_LIMIT");
  }
  if (ds.entities !== undefined) {
    if (!Array.isArray(ds.entities)) throw new ConstraintError("dataset.entities must be an array", undefined, "VALIDATION_ERROR");
    for (const ent of ds.entities) validateEntity(ent);
  }
  if (ds.aliases !== undefined) {
    if (!Array.isArray(ds.aliases)) throw new ConstraintError("dataset.aliases must be an array", undefined, "VALIDATION_ERROR");
    for (const al of ds.aliases) validateAlias(al);
  }
  if (ds.relations !== undefined) {
    if (!Array.isArray(ds.relations)) throw new ConstraintError("dataset.relations must be an array", undefined, "VALIDATION_ERROR");
    for (const rel of ds.relations) validateRelation(rel);
  }
  if (ds.claims !== undefined) {
    if (!Array.isArray(ds.claims)) throw new ConstraintError("dataset.claims must be an array", undefined, "VALIDATION_ERROR");
    for (const cl of ds.claims) validateClaim(cl);
  }
  if (ds.documents !== undefined) {
    if (!Array.isArray(ds.documents)) throw new ConstraintError("dataset.documents must be an array", undefined, "VALIDATION_ERROR");
    for (const doc of ds.documents) validateDocument(doc);
  }
}

export function validateQueryRequest(request: unknown): asserts request is QueryRequest {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new QueryError("QueryRequest must be a non-null object");
  }
  const req = request as Record<string, unknown>;
  if (typeof req.type !== "string") {
    throw new QueryError("Invalid query request: missing or non-string 'type'");
  }

  switch (req.type) {
    case "getCapabilities": {
      return;
    }
    case "resolve": {
      if (typeof req.alias !== "string" || req.alias.trim().length === 0) {
        throw new QueryError("Invalid alias: must be a non-empty string");
      }
      if (req.namespace !== undefined) {
        if (typeof req.namespace !== "string" || req.namespace.trim().length === 0) {
          throw new QueryError("Invalid namespace: must be a non-empty string");
        }
      }
      return;
    }
    case "getEntity": {
      if (typeof req.id !== "string" || req.id.trim().length === 0) {
        throw new QueryError("Invalid id: must be a non-empty string");
      }
      return;
    }
    case "findRelations": {
      if (req.subjectId !== undefined && (typeof req.subjectId !== "string" || req.subjectId.trim().length === 0)) {
        throw new QueryError("Invalid subjectId: must be a non-empty string");
      }
      if (req.objectId !== undefined && (typeof req.objectId !== "string" || req.objectId.trim().length === 0)) {
        throw new QueryError("Invalid objectId: must be a non-empty string");
      }
      if (req.predicate !== undefined && (typeof req.predicate !== "string" || req.predicate.trim().length === 0)) {
        throw new QueryError("Invalid predicate: must be a non-empty string");
      }
      if (!req.subjectId && !req.objectId) {
        throw new QueryError("findRelations requires at least subjectId or objectId");
      }
      validateResultLimit(req.limit);
      return;
    }
    case "findClaims": {
      if (typeof req.entityId !== "string" || req.entityId.trim().length === 0) {
        throw new QueryError("Invalid entityId: must be a non-empty string");
      }
      validateResultLimit(req.limit);
      return;
    }
    case "findDocuments": {
      if (typeof req.entityId !== "string" || req.entityId.trim().length === 0) {
        throw new QueryError("Invalid entityId: must be a non-empty string");
      }
      validateResultLimit(req.limit);
      return;
    }
    case "search": {
      const sq = req.search;
      if (!sq || typeof sq !== "object" || Array.isArray(sq)) {
        throw new QueryError("Search query must be a non-null object");
      }
      const s = sq as Record<string, unknown>;
      if (typeof s.query !== "string") {
        throw new QueryError("Invalid search query: must be a string");
      }
      if (s.query.length > 10000) {
        throw new QueryError("Query length exceeds maximum allowed length of 10000");
      }
      if (s.namespace !== undefined) {
        if (typeof s.namespace !== "string" || s.namespace.trim().length === 0) {
          throw new QueryError("Invalid search namespace: must be a non-empty string");
        }
      }
      if (s.kind !== undefined) {
        if (typeof s.kind !== "string" || s.kind.trim().length === 0) {
          throw new QueryError("Invalid search kind: must be a non-empty string");
        }
      }
      if (s.limit !== undefined) {
        if (typeof s.limit !== "number" || !Number.isInteger(s.limit) || s.limit < 0) {
          throw new QueryError(`Invalid limit: ${s.limit}`);
        }
      }
      if (s.mode !== undefined && (s.mode !== "lexical" && s.mode !== "semantic" && s.mode !== "hybrid")) {
        throw new QueryError("Invalid search mode: must be 'lexical', 'semantic', or 'hybrid'");
      }
      return;
    }
    case "traverse": {
      if (typeof req.startId !== "string" || req.startId.trim().length === 0) {
        throw new QueryError("Invalid startId: must be a non-empty string");
      }
      if (req.maxDepth !== undefined) {
        if (typeof req.maxDepth !== "number" || isNaN(req.maxDepth) || !Number.isInteger(req.maxDepth) || req.maxDepth < 0 || req.maxDepth > 100) {
          throw new QueryError("Invalid maxDepth: must be an integer between 0 and 100");
        }
      }
      if (req.maxPaths !== undefined) {
        if (typeof req.maxPaths !== "number" || isNaN(req.maxPaths) || !Number.isInteger(req.maxPaths) || req.maxPaths < 0 || req.maxPaths > 100000) {
          throw new QueryError("Invalid maxPaths: must be an integer between 0 and 100000");
        }
      }
      if (req.maxRelationsExpanded !== undefined) {
        if (typeof req.maxRelationsExpanded !== "number" || isNaN(req.maxRelationsExpanded) || !Number.isInteger(req.maxRelationsExpanded) || req.maxRelationsExpanded < 0) {
          throw new QueryError("Invalid maxRelationsExpanded: must be a non-negative integer");
        }
      }
      if (req.maxEntitiesHydrated !== undefined) {
        if (typeof req.maxEntitiesHydrated !== "number" || isNaN(req.maxEntitiesHydrated) || !Number.isInteger(req.maxEntitiesHydrated) || req.maxEntitiesHydrated < 0) {
          throw new QueryError("Invalid maxEntitiesHydrated: must be a non-negative integer");
        }
      }
      if (req.predicates !== undefined) {
        if (!Array.isArray(req.predicates)) {
          throw new QueryError("Invalid predicates: must be an array of strings");
        }
        for (const p of req.predicates) {
          if (typeof p !== "string" || p.trim().length === 0) {
            throw new QueryError("Invalid predicate in predicates list: must be a non-empty string");
          }
        }
      }
      if (req.steps !== undefined) {
        if (!Array.isArray(req.steps)) {
          throw new QueryError("Invalid traversal steps: must be an array");
        }
        for (let i = 0; i < req.steps.length; i++) {
          const step = req.steps[i];
          if (!step || typeof step !== "object" || Array.isArray(step)) {
            throw new QueryError(`Invalid traversal step at index ${i}: must be an object`);
          }
          if (step.direction !== "out" && step.direction !== "in" && step.direction !== "both") {
            throw new QueryError(`Invalid traversal step direction '${step.direction}' at index ${i}: must be 'out', 'in', or 'both'`);
          }
          if (step.predicates !== undefined) {
            if (!Array.isArray(step.predicates)) {
              throw new QueryError(`Invalid traversal step predicates at index ${i}: must be an array of strings`);
            }
            for (const p of step.predicates) {
              if (typeof p !== "string" || p.trim().length === 0) {
                throw new QueryError(`Invalid predicate in step at index ${i}: must be a non-empty string`);
              }
            }
          }
        }
      }
      return;
    }
    default: {
      throw new UnsupportedOperationError(`Unknown query type: ${req.type}`);
    }
  }
}
