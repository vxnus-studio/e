import { ConstraintError, QueryError } from "./errors.js";
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
} from "./types.js";

const VALID_CONFIDENCE_LEVELS = new Set(["canon", "theory", "outdated", "unverified"]);

function validateNonEmptyString(val: unknown, fieldName: string, maxLen: number = 1000): string {
  if (typeof val !== "string") {
    throw new ConstraintError(`Invalid ${fieldName}: must be a string`, undefined, "VALIDATION_ERROR");
  }
  const trimmed = val.trim();
  if (trimmed.length === 0) {
    throw new ConstraintError(`Invalid ${fieldName}: cannot be empty or whitespace-only`, undefined, "VALIDATION_ERROR");
  }
  if (val.length > maxLen) {
    throw new ConstraintError(`Invalid ${fieldName}: exceeds maximum allowed length of ${maxLen}`, undefined, "VALIDATION_ERROR");
  }
  return val;
}

function validateOptionalString(val: unknown, fieldName: string, maxLen: number = 10000): void {
  if (val === undefined || val === null) return;
  if (typeof val !== "string") {
    throw new ConstraintError(`Invalid ${fieldName}: must be a string`, undefined, "VALIDATION_ERROR");
  }
  if (val.length > maxLen) {
    throw new ConstraintError(`Invalid ${fieldName}: exceeds maximum allowed length of ${maxLen}`, undefined, "VALIDATION_ERROR");
  }
}

export function validateProvenance(prov: unknown): void {
  if (prov === undefined || prov === null) return;
  if (typeof prov !== "object" || Array.isArray(prov)) {
    throw new ConstraintError("Invalid provenance: must be an object", undefined, "VALIDATION_ERROR");
  }
  const p = prov as Record<string, unknown>;
  validateNonEmptyString(p.provider, "provenance.provider", 500);
  validateOptionalString(p.source, "provenance.source", 2000);
  validateOptionalString(p.sourceId, "provenance.sourceId", 500);
  validateOptionalString(p.sourceRevision, "provenance.sourceRevision", 500);
  validateOptionalString(p.locator, "provenance.locator", 2000);
  validateOptionalString(p.contentHash, "provenance.contentHash", 500);
  validateOptionalString(p.observedAt, "provenance.observedAt", 100);
  validateOptionalString(p.extractedVia, "provenance.extractedVia", 500);
  if (p.derivedFrom !== undefined && p.derivedFrom !== null) {
    if (!Array.isArray(p.derivedFrom)) {
      throw new ConstraintError("Invalid provenance.derivedFrom: must be an array of strings", undefined, "VALIDATION_ERROR");
    }
    for (const item of p.derivedFrom) {
      if (typeof item !== "string") {
        throw new ConstraintError("Invalid provenance.derivedFrom element: must be a string", undefined, "VALIDATION_ERROR");
      }
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
  for (const idm of identities) {
    if (!idm || typeof idm !== "object" || Array.isArray(idm)) {
      throw new ConstraintError("Invalid identity mapping: must be an object", undefined, "VALIDATION_ERROR");
    }
    validateNonEmptyString((idm as any).provider, "identity.provider", 500);
    validateNonEmptyString((idm as any).externalId, "identity.externalId", 1000);
  }
}

export function validateCanonicalJson(
  val: unknown,
  fieldName: string,
  seen: Set<unknown> = new Set()
): void {
  if (val === null) {
    return;
  }
  const t = typeof val;
  if (t === "string" || t === "boolean") {
    return;
  }
  if (t === "number") {
    if (!Number.isFinite(val)) {
      throw new ConstraintError(
        `Invalid ${fieldName}: number values must be finite (received ${val})`,
        undefined,
        "VALIDATION_ERROR"
      );
    }
    return;
  }
  if (t === "undefined") {
    throw new ConstraintError(
      `Invalid ${fieldName}: undefined is not allowed in canonical JSON`,
      undefined,
      "VALIDATION_ERROR"
    );
  }
  if (t === "bigint" || t === "symbol" || t === "function") {
    throw new ConstraintError(
      `Invalid ${fieldName}: type '${t}' is not supported in canonical JSON`,
      undefined,
      "VALIDATION_ERROR"
    );
  }
  if (t === "object") {
    if (seen.has(val)) {
      throw new ConstraintError(
        `Invalid ${fieldName}: cyclic structures are not allowed`,
        undefined,
        "VALIDATION_ERROR"
      );
    }
    seen.add(val);

    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        validateCanonicalJson(val[i], `${fieldName}[${i}]`, seen);
      }
      seen.delete(val);
      return;
    }

    const obj = val as Record<string, unknown>;
    const proto = Object.getPrototypeOf(obj);
    if (proto !== null && proto !== Object.prototype) {
      const ctorName = (obj as any).constructor?.name || "non-plain object";
      throw new ConstraintError(
        `Invalid ${fieldName}: custom class or non-plain object instance (${ctorName}) is not allowed in canonical JSON`,
        undefined,
        "VALIDATION_ERROR"
      );
    }

    for (const key of Object.keys(obj)) {
      const childVal = obj[key];
      if (childVal === undefined) {
        throw new ConstraintError(
          `Invalid ${fieldName}.${key}: undefined object properties are not allowed in canonical JSON`,
          undefined,
          "VALIDATION_ERROR"
        );
      }
      validateCanonicalJson(childVal, `${fieldName}.${key}`, seen);
    }
    seen.delete(val);
    return;
  }

  throw new ConstraintError(
    `Invalid ${fieldName}: unsupported value of type '${t}'`,
    undefined,
    "VALIDATION_ERROR"
  );
}

export function validateEntity(entity: unknown): asserts entity is Entity {
  if (!entity || typeof entity !== "object" || Array.isArray(entity)) {
    throw new ConstraintError("Entity must be a non-null object", undefined, "VALIDATION_ERROR");
  }
  const e = entity as Record<string, unknown>;
  validateNonEmptyString(e.id, "entity.id", 500);
  validateNonEmptyString(e.namespace, "entity.namespace", 200);
  validateNonEmptyString(e.kind, "entity.kind", 200);
  validateNonEmptyString(e.slug, "entity.slug", 500);
  validateNonEmptyString(e.name, "entity.name", 1000);

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
  validateNonEmptyString(a.id, "alias.id", 500);
  validateNonEmptyString(a.entityId, "alias.entityId", 500);
  validateNonEmptyString(a.alias, "alias.alias", 1000);
}

export function validateRelation(relation: unknown): asserts relation is Relation {
  if (!relation || typeof relation !== "object" || Array.isArray(relation)) {
    throw new ConstraintError("Relation must be a non-null object", undefined, "VALIDATION_ERROR");
  }
  const r = relation as Record<string, unknown>;
  validateNonEmptyString(r.id, "relation.id", 500);
  validateNonEmptyString(r.subjectId, "relation.subjectId", 500);
  validateNonEmptyString(r.predicate, "relation.predicate", 200);
  validateNonEmptyString(r.objectId, "relation.objectId", 500);

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
  validateNonEmptyString(c.id, "claim.id", 500);
  validateNonEmptyString(c.entityId, "claim.entityId", 500);
  validateNonEmptyString(c.statement, "claim.statement", 100000);
  validateNonEmptyString(c.source, "claim.source", 2000);

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
  validateNonEmptyString(d.id, "document.id", 500);
  validateNonEmptyString(d.entityId, "document.entityId", 500);
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
