import type { KnowledgePackManifest, KnowledgeProvider, ManifestValidationIssue, RetrievalRequest, RetrievalResponse } from "./types.js";
import { RetrievalValidationError } from "./types.js";

export function validateRetrievalRequest(request: unknown): RetrievalRequest {
  const issues: ManifestValidationIssue[] = [];
  if (typeof request !== "object" || request === null || Array.isArray(request)) throw new RetrievalValidationError([{ path: "$", message: "must be an object" }]);
  const value = request as Record<string, unknown>;
  if (typeof value.query !== "string") issues.push({ path: "$.query", message: "must be a string" });
  if (value.mode !== undefined && !["lexical", "semantic", "hybrid"].includes(value.mode as string)) issues.push({ path: "$.mode", message: "must be lexical, semantic, or hybrid" });
  if (value.limit !== undefined && (!Number.isInteger(value.limit) || (value.limit as number) < 0 || (value.limit as number) > 1000)) issues.push({ path: "$.limit", message: "must be an integer from 0 to 1000" });
  if (value.revision !== undefined && typeof value.revision !== "string") issues.push({ path: "$.revision", message: "must be a string when provided" });
  if (issues.length) throw new RetrievalValidationError(issues);
  return value as unknown as RetrievalRequest;
}

export function validateRetrievalResponse(response: unknown, manifest?: KnowledgePackManifest): RetrievalResponse {
  const issues: ManifestValidationIssue[] = [];
  if (typeof response !== "object" || response === null || Array.isArray(response)) throw new RetrievalValidationError([{ path: "$", message: "must be an object" }]);
  const value = response as Record<string, unknown>;
  if (!Array.isArray(value.results)) issues.push({ path: "$.results", message: "must be an array" });
  if (typeof value.revision !== "string" || value.revision.trim() === "") issues.push({ path: "$.revision", message: "must be a non-empty string" });
  if (value.partial !== undefined && typeof value.partial !== "boolean") issues.push({ path: "$.partial", message: "must be a boolean when provided" });
  if (Array.isArray(value.results)) value.results.forEach((result, index) => {
    const path = `$.results[${index}]`;
    if (typeof result !== "object" || result === null || Array.isArray(result)) { issues.push({ path, message: "must be an object" }); return; }
    const item = result as Record<string, unknown>;
    for (const key of ["id", "content", "revision"]) if (typeof item[key] !== "string" || item[key] === "") issues.push({ path: `${path}.${key}`, message: "must be a non-empty string" });
    if (!Array.isArray(item.citations) || item.citations.length === 0) issues.push({ path: `${path}.citations`, message: "must contain at least one citation" });
    else item.citations.forEach((citation, citationIndex) => {
      if (typeof citation !== "object" || citation === null || typeof (citation as Record<string, unknown>).sourceId !== "string" || (citation as Record<string, unknown>).sourceId === "") issues.push({ path: `${path}.citations[${citationIndex}].sourceId`, message: "must be a non-empty string" });
    });
    if (manifest && typeof item.revision === "string" && item.revision !== value.revision) issues.push({ path: `${path}.revision`, message: "must match response revision" });
  });
  if (issues.length) throw new RetrievalValidationError(issues);
  return value as unknown as RetrievalResponse;
}

export async function assertConformantProvider(provider: KnowledgeProvider): Promise<void> {
  const manifest = provider.manifest ? await provider.manifest() : undefined;
  if (provider.retrieve) {
    validateRetrievalRequest({ query: "", mode: "lexical", limit: 1 });
    const response = await provider.retrieve({ query: "", mode: "lexical", limit: 1 });
    if (manifest) validateRetrievalResponse(response, manifest);
    const repeat = await provider.retrieve({ query: "", mode: "lexical", limit: 1 });
    if (JSON.stringify(response) !== JSON.stringify(repeat)) throw new Error("provider returned non-deterministic retrieval results");
    if (manifest && manifest.capabilities.semanticSearch === false) {
      let accepted = false;
      try { await provider.retrieve({ query: "", mode: "semantic", limit: 1 }); accepted = true; } catch { /* expected */ }
      if (accepted) throw new Error("provider accepted unsupported semantic retrieval");
    }
  }
}
