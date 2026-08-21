import type {
  Entity,
  Alias,
  Relation,
  Claim,
  Document,
  QueryRequest,
  KnowledgeResult,
  EQueryEngine,
} from "./types.js";

export class InMemoryEngine implements EQueryEngine {
  private entities: Map<string, Entity> = new Map();
  private aliases: Alias[] = [];
  private relations: Relation[] = [];
  private claims: Claim[] = [];
  private documents: Document[] = [];

  insertEntity(entity: Entity) {
    this.entities.set(entity.id, entity);
  }

  insertAlias(alias: Alias) {
    this.aliases.push(alias);
  }

  insertRelation(relation: Relation) {
    this.relations.push(relation);
  }

  insertClaim(claim: Claim) {
    this.claims.push(claim);
  }

  insertDocument(doc: Document) {
    this.documents.push(doc);
  }

  async query(request: QueryRequest): Promise<KnowledgeResult> {
    const startTime = Date.now();
    const result: KnowledgeResult = {
      entities: [],
      relations: [],
      claims: [],
      documents: [],
      metadata: { timeMs: 0 },
    };

    switch (request.type) {
      case "resolve": {
        const matches = this.aliases.filter(
          (a) => a.alias === request.alias
        );
        for (const match of matches) {
          const entity = this.entities.get(match.entityId);
          if (
            entity &&
            (!request.namespace || entity.namespace === request.namespace)
          ) {
            result.entities.push(entity);
          }
        }
        break;
      }
      case "getEntity": {
        const entity = this.entities.get(request.id);
        if (entity) {
          result.entities.push(entity);
        }
        break;
      }
      case "findRelations": {
        const matchingRelations = this.relations.filter(
          (r) =>
            (!request.subjectId || r.subjectId === request.subjectId) &&
            (!request.objectId || r.objectId === request.objectId) &&
            (!request.predicate || r.predicate === request.predicate)
        );
        result.relations = matchingRelations;
        
        // Hydrate related entities
        for (const rel of matchingRelations) {
          const subj = this.entities.get(rel.subjectId);
          if (subj && !result.entities.some(e => e.id === subj.id)) {
            result.entities.push(subj);
          }
          const obj = this.entities.get(rel.objectId);
          if (obj && !result.entities.some(e => e.id === obj.id)) {
            result.entities.push(obj);
          }
        }
        break;
      }
      case "findClaims": {
        const matchingClaims = this.claims.filter(
          (c) => c.entityId === request.entityId
        );
        result.claims = matchingClaims;
        break;
      }
      case "findDocuments": {
        const matchingDocs = this.documents.filter(
          (d) => d.entityId === request.entityId
        );
        result.documents = matchingDocs;
        break;
      }
      case "search": {
        if (request.limit !== undefined && request.limit <= 0) {
          return result;
        }
        const q = request.query.toLowerCase();
        for (const entity of this.entities.values()) {
          if (
            (!request.namespace || entity.namespace === request.namespace) &&
            (entity.name.toLowerCase().includes(q) || entity.slug.toLowerCase().includes(q))
          ) {
            result.entities.push(entity);
          }
        }
        // Deterministic ordering by id (Binary / ASCII order)
        result.entities.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
        if (request.limit !== undefined && result.entities.length > request.limit) {
          result.entities = result.entities.slice(0, request.limit);
        }
        break;
      }
      case "traverse": {
        // Stub for graph traversal
        result.metadata.warnings = ["Traverse is not fully implemented in InMemoryEngine"];
        break;
      }
    }

    result.metadata.timeMs = Date.now() - startTime;
    return result;
  }
}
