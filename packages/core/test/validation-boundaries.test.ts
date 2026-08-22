import { describe, expect, test } from "vitest";
import {
  validateAlias,
  validateClaim,
  validateDocument,
  validateEntity,
  validateRelation,
} from "../src/validation.js";
import { MAX_STORAGE_IDENTIFIER_LENGTH, MAX_STORAGE_SHORT_TEXT_LENGTH } from "../src/types.js";

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
});
