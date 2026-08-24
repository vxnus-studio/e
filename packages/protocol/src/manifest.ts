import type { KnowledgePackManifest, ManifestValidationIssue, PackSource } from "./types.js";
import { ManifestValidationError } from "./types.js";

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const SCHEMA_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const URI = /^[a-z][a-z\d+.-]*:\S+$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function checkKeys(value: Record<string, unknown>, allowed: string[], path: string, issues: ManifestValidationIssue[]) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) issues.push({ path: `${path}.${key}`, message: "is not allowed" });
  }
}

function requiredString(value: Record<string, unknown>, key: string, path: string, issues: ManifestValidationIssue[]) {
  if (typeof value[key] !== "string" || value[key].trim() === "") {
    issues.push({ path: `${path}.${key}`, message: "must be a non-empty string" });
  }
}

function validateSource(value: unknown, index: number, issues: ManifestValidationIssue[]): value is PackSource {
  const path = `sources[${index}]`;
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object" });
    return false;
  }
  checkKeys(value, ["id", "title", "license", "uri", "publishedAt"], path, issues);
  requiredString(value, "id", path, issues);
  requiredString(value, "title", path, issues);
  requiredString(value, "license", path, issues);
  for (const key of ["uri", "publishedAt"]) {
    if (value[key] !== undefined && (typeof value[key] !== "string" || value[key].trim() === "")) {
      issues.push({ path: `${path}.${key}`, message: "must be a non-empty string when provided" });
    }
  }
  if (typeof value.uri === "string" && !URI.test(value.uri)) issues.push({ path: `${path}.uri`, message: "must be an absolute URI" });
  return true;
}

export function validateManifest(input: unknown): KnowledgePackManifest {
  const issues: ManifestValidationIssue[] = [];
  if (!isRecord(input)) throw new ManifestValidationError([{ path: "$", message: "must be an object" }]);
  checkKeys(input, ["id", "name", "publisher", "version", "schemaVersion", "description", "sources", "capabilities"], "$", issues);
  for (const key of ["id", "name", "publisher", "version", "schemaVersion", "sources", "capabilities"]) {
    if (input[key] === undefined) issues.push({ path: `$.${key}`, message: "is required" });
  }
  for (const key of ["id", "name", "publisher"]) requiredString(input, key, "$", issues);
  if (typeof input.version === "string" && !SEMVER.test(input.version)) issues.push({ path: "$.version", message: "must be a valid semantic version" });
  if (typeof input.schemaVersion === "string" && !SCHEMA_VERSION.test(input.schemaVersion)) issues.push({ path: "$.schemaVersion", message: "must use MAJOR.MINOR format" });
  if (input.description !== undefined && typeof input.description !== "string") issues.push({ path: "$.description", message: "must be a string" });

  if (!Array.isArray(input.sources)) issues.push({ path: "$.sources", message: "must be an array" });
  else {
    if (input.sources.length === 0) issues.push({ path: "$.sources", message: "must contain at least one source" });
    const ids = new Set<string>();
    input.sources.forEach((source, index) => {
      if (validateSource(source, index, issues) && typeof source.id === "string") {
        if (ids.has(source.id)) issues.push({ path: `sources[${index}].id`, message: "must be unique" });
        ids.add(source.id);
      }
    });
  }

  const capabilities = input.capabilities;
  if (!isRecord(capabilities)) issues.push({ path: "$.capabilities", message: "must be an object" });
  else {
    const keys = ["lexicalSearch", "semanticSearch", "structuredEntities", "relations", "revisions"];
    checkKeys(capabilities, keys, "$.capabilities", issues);
    for (const key of keys) if (typeof capabilities[key] !== "boolean") issues.push({ path: `$.capabilities.${key}`, message: "must be a boolean" });
    if (capabilities.relations === true && capabilities.structuredEntities !== true) issues.push({ path: "$.capabilities.relations", message: "requires structuredEntities=true" });
  }
  if (issues.length > 0) throw new ManifestValidationError(issues);
  return input as unknown as KnowledgePackManifest;
}
