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

import { DEFAULT_MAX_DEPTH } from "./types.js";

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
        if (!request.subjectId && !request.objectId) {
          throw new Error("findRelations requires at least subjectId or objectId");
        }
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
        const startEntity = this.entities.get(request.startId);
        if (!startEntity) {
          break; // missing start entity yields empty result
        }

        const maxDepth = request.maxDepth !== undefined ? request.maxDepth : DEFAULT_MAX_DEPTH;
        if (maxDepth < 0) {
          break; // return empty
        }

        const visited = new Set<string>();
        let frontier: string[] = [request.startId];
        const resultEntities: Entity[] = [];

        visited.add(request.startId);
        let currentDepth = 0;

        while (frontier.length > 0 && currentDepth <= maxDepth) {
          for (const id of frontier) {
            const ent = this.entities.get(id);
            if (ent) {
              resultEntities.push(ent);
            }
          }

          if (currentDepth >= maxDepth) {
            break;
          }

          const newFrontier: string[] = [];
          for (const parentId of frontier) {
            const outgoing = this.relations.filter((r) => r.subjectId === parentId);
            
            let filteredEdges = outgoing;
            if (request.predicates && request.predicates.length > 0) {
              const predSet = new Set(request.predicates);
              filteredEdges = outgoing.filter((r) => predSet.has(r.predicate));
            }

            filteredEdges.sort((a, b) => (a.objectId < b.objectId ? -1 : a.objectId > b.objectId ? 1 : 0));

            for (const edge of filteredEdges) {
              if (!visited.has(edge.objectId)) {
                visited.add(edge.objectId);
                newFrontier.push(edge.objectId);
              }
            }
          }
          frontier = newFrontier;
          currentDepth++;
        }

        result.entities = resultEntities;
        break;
      }
      default: {
        throw new Error(`Unknown query type: ${(request as any).type}`);
      }
    }

    result.metadata.timeMs = Date.now() - startTime;
    return result;
  }
}
