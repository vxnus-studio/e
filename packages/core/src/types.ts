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
  data: Record<string, unknown>;
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
  metadata?: Record<string, unknown>;
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
  | ({ type: "findRelations"; predicate?: string } & (
      | { subjectId: string; objectId?: string }
      | { subjectId?: string; objectId: string }
    ))
  | { type: "findClaims"; entityId: string }
  | { type: "findDocuments"; entityId: string }
  | { type: "search"; search: SearchQuery }
  | { type: "traverse"; startId: string; steps?: TraversalStep[]; maxDepth?: number; maxPaths?: number; predicates?: string[] }
  | { type: "getCapabilities" };

export const DEFAULT_MAX_DEPTH = 5;

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
