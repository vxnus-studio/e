export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface PackIdentity { id: string; name: string; publisher: string; version: string; schemaVersion: string; }
export interface PackSource { id: string; title: string; uri?: string; license?: string; publishedAt?: string; }
export interface PackDocument { id: string; sourceId: string; content: string; revision: string; metadata?: JsonObject; }
export interface PackChunk { id: string; documentId: string; content: string; ordinal: number; embedding?: number[]; }
export interface PackEntity { id: string; kind: string; name: string; aliases?: string[]; metadata?: JsonObject; }
export interface PackRelation { id: string; subjectId: string; predicate: string; objectId: string; metadata?: JsonObject; }
export interface PackRevision { id: string; createdAt: string; parentId?: string; contentHash?: string; }
export interface PackCapabilities { lexicalSearch: boolean; semanticSearch: boolean; structuredEntities: boolean; relations: boolean; revisions: boolean; }
export interface KnowledgePackManifest extends PackIdentity { description?: string; sources: PackSource[]; capabilities: PackCapabilities; }
export interface RetrievalRequest { query: string; limit?: number; revision?: string; filters?: JsonObject; }
export interface RetrievalCitation { sourceId: string; documentId?: string; chunkId?: string; locator?: string; }
export interface RetrievalResult { id: string; content: string; citations: RetrievalCitation[]; revision: string; score?: number; metadata?: JsonObject; }
export interface RetrievalResponse { results: RetrievalResult[]; revision: string; partial?: boolean; }
export interface KnowledgeProvider { manifest(): Promise<KnowledgePackManifest> | KnowledgePackManifest; retrieve(request: RetrievalRequest): Promise<RetrievalResponse>; }
