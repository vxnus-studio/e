export interface Provenance {
  provider: string;
  source?: string;
  sourceId?: string;
  sourceRevision?: string;
  locator?: string;
  contentHash?: string;
  observedAt?: string;
  extractedVia?: string;
  confidence?: "canon" | "theory" | "outdated" | "unverified" | string;
  derivedFrom?: string[];
}

export interface TemporalSemantics {
  observedAt?: string;
  publishedAt?: string;
  validFrom?: string;
  validUntil?: string;
}

export type CanonicalJsonPrimitive = string | number | boolean | null;

export type CanonicalJsonValue =
  | CanonicalJsonPrimitive
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

export type CanonicalJsonObject = { [key: string]: CanonicalJsonValue };

export interface IdentityMapping {
  provider: string;
  externalId: string;
}

export interface Entity {
  id: string; // The canonical E identifier
  namespace: string;
  kind: string;
  slug: string;
  name: string;
  data: CanonicalJsonObject;
  identities?: IdentityMapping[];
  provenance?: Provenance;
  temporal?: TemporalSemantics;
}

export interface Alias {
  id: string;
  entityId: string;
  alias: string;
}

export interface Relation {
  id: string;
  subjectId: string;
  predicate: string;
  objectId: string;
  provenance?: Provenance;
  temporal?: TemporalSemantics;
  metadata?: CanonicalJsonObject;
}

export interface Claim {
  id: string;
  entityId: string;
  statement: string;
  confidence: "canon" | "theory" | "outdated" | "unverified";
  source: string;
  provenance?: Provenance;
  temporal?: TemporalSemantics;
}

export interface Document {
  id: string;
  entityId: string;
  content: string;
  provenance?: Provenance;
}

export interface TraversalStep {
  predicates?: string[];
  direction: "out" | "in" | "both";
}

export interface TraversalPathEdge {
  relationId: string;
  sourceId: string;
  targetId: string;
  predicate: string;
  direction: "out" | "in";
}

export interface TraversalPath {
  startId: string;
  endId: string;
  edges: TraversalPathEdge[];
  depth: number;
}

export interface TraversalResult {
  entities: Entity[];
  relations: Relation[];
  paths: TraversalPath[];
}

// Search
export interface SearchQuery {
  query: string;
  namespace?: string;
  kind?: string;
  limit?: number;
  mode?: "lexical" | "semantic" | "hybrid";
}

export interface SearchMatch {
  entityId: string;
  score?: number;
  matchReason?: string;
}

export interface SearchResult {
  entities: Entity[];
  matches: SearchMatch[];
}

export interface ProviderCapabilities {
  exactResolution: boolean;
  lexicalSearch: boolean;
  semanticSearch: boolean;
  hybridSearch: boolean;
  relations: boolean;
  traversal: boolean;
  claims: boolean;
  documents: boolean;
  provenance: boolean;
  temporalQueries: boolean;
}

// Query Requests
export type QueryRequest =
  | { type: "resolve"; alias: string; namespace?: string }
  | { type: "getEntity"; id: string }
  | ({ type: "findRelations"; predicate?: string; limit?: number } & (
      | { subjectId: string; objectId?: string }
      | { subjectId?: string; objectId: string }
    ))
  | { type: "findClaims"; entityId: string; limit?: number }
  | { type: "findDocuments"; entityId: string; limit?: number }
  | { type: "search"; search: SearchQuery }
  | {
      type: "traverse";
      startId: string;
      steps?: TraversalStep[];
      maxDepth?: number;
      maxPaths?: number;
      predicates?: string[];
      maxRelationsExpanded?: number;
      maxEntitiesHydrated?: number;
    }
  | { type: "getCapabilities" };

export const DEFAULT_MAX_DEPTH = 5;
export const DEFAULT_MAX_PATHS = 1000;
export const MAX_SAFE_DEPTH = 100;
export const MAX_SAFE_PATHS = 100000;
export const MAX_SAFE_SEARCH_LIMIT = 10000;
export const DEFAULT_MAX_RESULT_LIMIT = 1000;
export const MAX_SAFE_RESULT_LIMIT = 10000;
export const MAX_SAFE_BATCH_ITEMS = 100000;
export const MAX_SAFE_SEARCH_QUERY_LENGTH = 10000;
export const DEFAULT_MAX_RELATIONS_EXPANDED = 100000;
export const DEFAULT_MAX_ENTITIES_HYDRATED = 50000;

// Storage contract: these values match the VARCHAR(255) columns in the
// PostgreSQL schema and the explicit SQLite length checks.
export const MAX_STORAGE_IDENTIFIER_LENGTH = 255;
export const MAX_STORAGE_SHORT_TEXT_LENGTH = 255;
export const MAX_PROVENANCE_PROVIDER_LENGTH = 500;
export const MAX_PROVENANCE_SOURCE_LENGTH = 2000;
export const MAX_PROVENANCE_SOURCE_ID_LENGTH = 500;
export const MAX_PROVENANCE_SOURCE_REVISION_LENGTH = 500;
export const MAX_PROVENANCE_LOCATOR_LENGTH = 2000;
export const MAX_PROVENANCE_CONTENT_HASH_LENGTH = 500;
export const MAX_PROVENANCE_OBSERVED_AT_LENGTH = 100;
export const MAX_PROVENANCE_EXTRACTED_VIA_LENGTH = 500;
export const MAX_IDENTITY_EXTERNAL_ID_LENGTH = 1000;

// Canonical JSON is persisted as one bounded payload. These limits are large
// enough for normal knowledge records while preventing recursive validation,
// driver payloads, and lineage arrays from becoming unbounded resources.
export const MAX_SAFE_JSON_DEPTH = 64;
export const MAX_SAFE_JSON_ARRAY_LENGTH = 10_000;
export const MAX_SAFE_JSON_OBJECT_KEYS = 10_000;
export const MAX_SAFE_JSON_STRING_LENGTH = 1_000_000;
export const MAX_SAFE_JSON_SERIALIZED_LENGTH = 4_000_000;
export const MAX_SAFE_IDENTITY_MAPPINGS = 1_000;
export const MAX_SAFE_PROVENANCE_LINEAGE = 1_000;

export interface QueryMetadata {
  timeMs: number;
  warnings?: string[];
  partial?: boolean;
}

export interface KnowledgeResult {
  entities?: Entity[];
  relations?: Relation[];
  claims?: Claim[];
  documents?: Document[];
  traversal?: TraversalResult;
  search?: SearchResult;
  capabilities?: ProviderCapabilities;
  metadata: QueryMetadata;
}

export interface EQueryEngine {
  query(request: QueryRequest): Promise<KnowledgeResult>;
}

export interface EFixtureMutator {
  insertEntity(entity: Entity): Promise<void> | void;
  insertAlias(alias: Alias): Promise<void> | void;
  insertRelation(relation: Relation): Promise<void> | void;
  insertClaim(claim: Claim): Promise<void> | void;
  insertDocument(doc: Document): Promise<void> | void;
}

export interface BatchDataset {
  entities?: Entity[];
  aliases?: Alias[];
  relations?: Relation[];
  claims?: Claim[];
  documents?: Document[];
}

export interface BatchIngestResult {
  entitiesInserted: number;
  aliasesInserted: number;
  relationsInserted: number;
  claimsInserted: number;
  documentsInserted: number;
  timeMs: number;
}

export interface EBatchMutator {
  ingestBatch(dataset: BatchDataset): Promise<BatchIngestResult>;
}
