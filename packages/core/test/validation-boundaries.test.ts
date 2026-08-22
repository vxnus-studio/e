import { describe, expect, test } from "vitest";
import {
  validateAlias,
  validateClaim,
  validateDocument,
  validateEntity,
  validateRelation,
  validateCanonicalJson,
} from "../src/validation.js";
import {
  MAX_STORAGE_IDENTIFIER_LENGTH,
  MAX_STORAGE_SHORT_TEXT_LENGTH,
  MAX_SAFE_JSON_DEPTH,
  MAX_SAFE_JSON_ARRAY_LENGTH,
  MAX_SAFE_JSON_OBJECT_KEYS,
  MAX_SAFE_JSON_STRING_LENGTH,
  MAX_SAFE_JSON_SERIALIZED_LENGTH,
  MAX_SAFE_IDENTITY_MAPPINGS,
  MAX_SAFE_PROVENANCE_LINEAGE,
} from "../src/types.js";

const repeated = (length: number) => "x".repeat(length);
const entity = (overrides: Record<string, unknown> = {}) => ({
  id: "entity-1",
  namespace: "test",
  kind: "node",
  slug: "entity-1",
  name: "Entity",
  data: {},
  ...overrides,
});

describe("storage contract string boundaries", () => {
  test.each(["id", "namespace", "kind", "slug", "name"])(
    "entity.%s accepts the maximum and rejects maximum + 1",
    (field) => {
      expect(() => validateEntity(entity({ [field]: repeated(MAX_STORAGE_SHORT_TEXT_LENGTH) }))).not.toThrow();
      expect(() => validateEntity(entity({ [field]: repeated(MAX_STORAGE_SHORT_TEXT_LENGTH + 1) }))).toThrow("exceeds maximum");
    },
  );

  test("entity.id uses the same 255-character boundary as other identifiers", () => {
    expect(() => validateEntity(entity({ id: repeated(MAX_STORAGE_IDENTIFIER_LENGTH) }))).not.toThrow();
    expect(() => validateEntity(entity({ id: repeated(MAX_STORAGE_IDENTIFIER_LENGTH + 1) }))).toThrow("exceeds maximum");
  });

  test("alias, relation, claim, and document constrained fields share SQL limits", () => {
    expect(() => validateAlias({ id: repeated(256), entityId: "e", alias: "a" })).toThrow("exceeds maximum");
    expect(() => validateAlias({ id: "a", entityId: "e", alias: repeated(256) })).toThrow("exceeds maximum");
    expect(() => validateRelation({ id: "r", subjectId: "s", predicate: repeated(256), objectId: "o" })).toThrow("exceeds maximum");
    expect(() => validateClaim({ id: "c", entityId: "e", statement: "statement", confidence: "canon", source: repeated(256) })).toThrow("exceeds maximum");
    expect(() => validateDocument({ id: repeated(256), entityId: "e", content: "content" })).toThrow("exceeds maximum");
  });

  test("empty and malformed constrained values remain rejected", () => {
    expect(() => validateEntity(entity({ name: "" }))).toThrow("cannot be empty");
    expect(() => validateEntity(entity({ namespace: "   " }))).toThrow("cannot be empty");
    expect(() => validateRelation({ id: "r", subjectId: "s", predicate: 1, objectId: "o" })).toThrow("must be a string");
  });

  test("Unicode boundaries count characters consistently with SQL length semantics", () => {
    const value = "🙂".repeat(MAX_STORAGE_SHORT_TEXT_LENGTH);
    expect(() => validateEntity(entity({ name: value }))).not.toThrow();
    expect(() => validateEntity(entity({ name: `${value}🙂` }))).toThrow("exceeds maximum");
  });

  test("canonical JSON bounds depth, arrays, objects, strings, and serialized size", () => {
    let nested: Record<string, unknown> = {};
    for (let i = 0; i < MAX_SAFE_JSON_DEPTH; i++) nested = { child: nested };
    expect(() => validateCanonicalJson(nested, "data")).not.toThrow();
    expect(() => validateCanonicalJson({ child: { child: nested } }, "data")).toThrow("maximum depth");
    expect(() => validateCanonicalJson(Array.from({ length: MAX_SAFE_JSON_ARRAY_LENGTH }, () => null), "data")).not.toThrow();
    expect(() => validateCanonicalJson(Array.from({ length: MAX_SAFE_JSON_ARRAY_LENGTH + 1 }, () => null), "data")).toThrow("array exceeds");
    const objectAtLimit = Object.fromEntries(Array.from({ length: MAX_SAFE_JSON_OBJECT_KEYS }, (_, i) => [`k${i}`, null]));
    expect(() => validateCanonicalJson(objectAtLimit, "data")).not.toThrow();
    expect(() => validateCanonicalJson({ ...objectAtLimit, overflow: null }, "data")).toThrow("key count");
    expect(() => validateCanonicalJson("x".repeat(MAX_SAFE_JSON_STRING_LENGTH), "data")).not.toThrow();
    expect(() => validateCanonicalJson("x".repeat(MAX_SAFE_JSON_STRING_LENGTH + 1), "data")).toThrow("string exceeds");
    expect(() => validateCanonicalJson({ values: Array.from({ length: 10 }, () => "x".repeat(500_000)) }, "data")).toThrow("serialized JSON");
  });

  test("identity and provenance collections are bounded", () => {
    const identities = Array.from({ length: MAX_SAFE_IDENTITY_MAPPINGS }, (_, i) => ({ provider: "p", externalId: String(i) }));
    expect(() => validateEntity(entity({ identities }))).not.toThrow();
    expect(() => validateEntity(entity({ identities: [...identities, { provider: "p", externalId: "overflow" }] }))).toThrow("identities");
    const lineage = Array.from({ length: MAX_SAFE_PROVENANCE_LINEAGE }, (_, i) => `source-${i}`);
    expect(() => validateEntity(entity({ provenance: { provider: "p", derivedFrom: lineage } }))).not.toThrow();
    expect(() => validateEntity(entity({ provenance: { provider: "p", derivedFrom: [...lineage, "overflow"] } }))).toThrow("derivedFrom");
  });
});
