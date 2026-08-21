export interface Entity {
  id: string;
  namespace: string;
  kind: string;
  slug: string;
  name: string;
  data: Record<string, unknown>;
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
}

export interface Claim {
  id: string;
  entityId: string;
  statement: string;
  confidence: "canon" | "theory" | "outdated";
  source: string;
}

export interface Document {
  id: string;
  entityId: string;
  content: string;
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
  | { type: "search"; query: string; namespace?: string; limit?: number }
  | { type: "traverse"; startId: string; maxDepth?: number; predicates?: string[] };

export const DEFAULT_MAX_DEPTH = 5;

export interface QueryMetadata {
  timeMs: number;
  warnings?: string[];
  partial?: boolean;
}

export interface KnowledgeResult {
  entities: Entity[];
  relations: Relation[];
  claims: Claim[];
  documents: Document[];
  metadata: QueryMetadata;
}

export interface EQueryEngine {
  query(request: QueryRequest): Promise<KnowledgeResult>;
}
