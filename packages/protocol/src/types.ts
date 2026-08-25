export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface PackIdentity { id: string; name: string; publisher: string; version: string; schemaVersion: string; }
export interface PackSource { id: string; title: string; license: string; licenseDescription?: string; licenseUrl?: string; uri?: string; publishedAt?: string; }
export interface PackDocument { id: string; sourceId: string; content: string; revision: string; metadata?: JsonObject; }
export interface PackChunk { id: string; documentId: string; content: string; ordinal: number; embedding?: number[]; }
export interface PackEntity { id: string; kind: string; name: string; aliases?: string[]; metadata?: JsonObject; }
export interface PackRelation { id: string; subjectId: string; predicate: string; objectId: string; metadata?: JsonObject; }
export interface PackRevision { id: string; createdAt: string; parentId?: string; contentHash?: string; }
export interface PackCapabilities { lexicalSearch: boolean; semanticSearch: boolean; structuredEntities: boolean; relations: boolean; revisions: boolean; }
/** Public retrieval metadata only; credentials and provider secrets never belong here. */
export interface EmbeddingProfile { model: string; dimensions: number; provider: string; }
export interface RetrievalProfile { embedding?: EmbeddingProfile; }
export interface PackLicense { license: string; licenseName: string; licenseUrl: string; rightsHolder?: string; copyrightNotice?: string; attributionText?: string; notice?: string; }
export interface KnowledgePackManifest extends PackIdentity { description?: string; license?: PackLicense; sources: PackSource[]; capabilities: PackCapabilities; retrieval?: RetrievalProfile; }
export interface RetrievalRequest { query: string; mode?: "lexical" | "semantic" | "hybrid"; limit?: number; revision?: string; filters?: JsonObject; }
export interface RetrievalCitation { sourceId: string; documentId?: string; chunkId?: string; locator?: string; }
export interface RetrievalResult { id: string; content: string; citations: RetrievalCitation[]; revision: string; score?: number; metadata?: JsonObject; }
export interface RetrievalResponse { results: RetrievalResult[]; revision: string; partial?: boolean; }
export interface KnowledgeProvider { manifest(): Promise<KnowledgePackManifest> | KnowledgePackManifest; retrieve(request: RetrievalRequest): Promise<RetrievalResponse>; }

export interface ManifestValidationIssue { path: string; message: string; }

export class ManifestValidationError extends Error {
  readonly issues: ManifestValidationIssue[];

  constructor(issues: ManifestValidationIssue[]) {
    super(`Invalid knowledge pack manifest: ${issues.map(issue => `${issue.path} ${issue.message}`).join("; ")}`);
    this.name = "ManifestValidationError";
    this.issues = issues;
  }
}

export class RetrievalValidationError extends Error {
  readonly issues: ManifestValidationIssue[];
  constructor(issues: ManifestValidationIssue[]) {
    super(`Invalid retrieval response: ${issues.map(issue => `${issue.path} ${issue.message}`).join("; ")}`);
    this.name = "RetrievalValidationError";
    this.issues = issues;
  }
}
