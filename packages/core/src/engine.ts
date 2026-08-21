import type {
  Entity,
  Alias,
  Relation,
  Claim,
  Document,
  QueryRequest,
  KnowledgeResult,
  EQueryEngine,
  TraversalPath,
  TraversalPathEdge,
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
      case "getCapabilities": {
        result.capabilities = {
          exactResolution: true,
          lexicalSearch: true,
          semanticSearch: false,
          hybridSearch: false,
          relations: true,
          traversal: true,
          claims: true,
          documents: true,
          provenance: true,
          temporalQueries: false,
        };
        break;
      }
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
            result.entities!.push(entity);
          }
        }
        break;
      }
      case "getEntity": {
        const entity = this.entities.get(request.id);
        if (entity) {
          result.entities!.push(entity);
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
          if (subj && !result.entities!.some(e => e.id === subj.id)) {
            result.entities!.push(subj);
          }
          const obj = this.entities.get(rel.objectId);
          if (obj && !result.entities!.some(e => e.id === obj.id)) {
            result.entities!.push(obj);
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
        const sq = request.search;
        if (sq.limit !== undefined && sq.limit <= 0) {
          result.search = { entities: [], matches: [] };
          break;
        }
        const q = sq.query.toLowerCase();
        for (const entity of this.entities.values()) {
          if (
            (!sq.namespace || entity.namespace === sq.namespace) &&
            (!sq.kind || entity.kind === sq.kind) &&
            (entity.name.toLowerCase().includes(q) || entity.slug.toLowerCase().includes(q))
          ) {
            result.entities!.push(entity);
          }
        }
        // Deterministic ordering by id (Binary / ASCII order)
        result.entities!.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
        if (sq.limit !== undefined && result.entities!.length > sq.limit) {
          result.entities = result.entities!.slice(0, sq.limit);
        }
        
        result.search = {
          entities: result.entities!,
          matches: result.entities!.map(e => ({
            entityId: e.id,
            score: 1.0,
            matchReason: "lexical"
          }))
        };
        break;
      }
      case "traverse": {
        const startEntity = this.entities.get(request.startId);
        if (!startEntity) {
          result.traversal = { entities: [], relations: [], paths: [] };
          break; // missing start entity yields empty result
        }

        const maxDepth = request.maxDepth !== undefined ? request.maxDepth : DEFAULT_MAX_DEPTH;
        if (maxDepth < 0) {
          result.traversal = { entities: [], relations: [], paths: [] };
          break; // return empty
        }
        
        // Use either steps or fallback to predicates string[]
        const steps = request.steps || (request.predicates ? [{ predicates: request.predicates, direction: "out" as const }] : []);

        const visitedEntities = new Map<string, Entity>();
        const visitedRelations = new Map<string, Relation>();
        const paths: TraversalPath[] = [];

        visitedEntities.set(startEntity.id, startEntity);

        interface FrontierItem {
          entityId: string;
          pathEdges: TraversalPathEdge[];
          depth: number;
        }

        let frontier: FrontierItem[] = [{ entityId: request.startId, pathEdges: [], depth: 0 }];

        // Prevent infinite loops / unbounded expansion
        const pathLimit = 1000;
        let pathCount = 0;

        while (frontier.length > 0 && pathCount < pathLimit) {
          const current = frontier.shift()!;

          if (current.depth >= maxDepth) {
            paths.push({
              startId: request.startId,
              endId: current.entityId,
              edges: current.pathEdges,
              depth: current.depth
            });
            pathCount++;
            continue;
          }
          
          let stepFilter = steps[current.depth];
          let allowedDir = stepFilter ? stepFilter.direction : "out";
          let allowedPreds = stepFilter && stepFilter.predicates ? new Set(stepFilter.predicates) : 
                             (request.predicates ? new Set(request.predicates) : null);

          let foundAny = false;

          const outEdges = (allowedDir === "out" || allowedDir === "both") 
            ? this.relations.filter(r => r.subjectId === current.entityId)
            : [];
          
          const inEdges = (allowedDir === "in" || allowedDir === "both")
            ? this.relations.filter(r => r.objectId === current.entityId)
            : [];

          const allEdges = [...outEdges.map(e => ({r: e, dir: "out" as const})), ...inEdges.map(e => ({r: e, dir: "in" as const}))];
          
          // Deterministic sorting
          allEdges.sort((a, b) => {
            if (a.r.id !== b.r.id) return a.r.id < b.r.id ? -1 : 1;
            return 0;
          });

          for (const {r, dir} of allEdges) {
            if (allowedPreds && !allowedPreds.has(r.predicate)) {
              continue;
            }
            
            // Cycle detection per path
            if (current.pathEdges.some(pe => pe.relationId === r.id)) {
              continue;
            }

            const nextId = dir === "out" ? r.objectId : r.subjectId;
            const nextEnt = this.entities.get(nextId);
            
            if (!nextEnt) continue;

            visitedEntities.set(nextEnt.id, nextEnt);
            visitedRelations.set(r.id, r);

            const newEdge: TraversalPathEdge = {
              relationId: r.id,
              sourceId: dir === "out" ? current.entityId : nextId,
              targetId: dir === "out" ? nextId : current.entityId,
              predicate: r.predicate,
              direction: dir
            };

            frontier.push({
              entityId: nextId,
              pathEdges: [...current.pathEdges, newEdge],
              depth: current.depth + 1
            });
            foundAny = true;
          }
          
          if (!foundAny && current.depth > 0) {
            paths.push({
              startId: request.startId,
              endId: current.entityId,
              edges: current.pathEdges,
              depth: current.depth
            });
            pathCount++;
          }
        }
        
        // Cleanup paths if they don't terminate or we hit limits
        if (frontier.length > 0) {
           for(const f of frontier) {
             if (f.depth > 0) {
                paths.push({
                  startId: request.startId,
                  endId: f.entityId,
                  edges: f.pathEdges,
                  depth: f.depth
                });
             }
           }
        }
        
        // Sort paths deterministically
        paths.sort((a, b) => {
          if (a.depth !== b.depth) return a.depth - b.depth;
          const aStr = a.edges.map(e => e.relationId).join(",");
          const bStr = b.edges.map(e => e.relationId).join(",");
          if (aStr !== bStr) return aStr < bStr ? -1 : 1;
          return 0;
        });

        result.traversal = {
          entities: Array.from(visitedEntities.values()),
          relations: Array.from(visitedRelations.values()),
          paths: paths
        };
        // also map them to top level arrays for backward compat (or not, if breaking is okay? We'll leave them).
        result.entities = result.traversal.entities;
        result.relations = result.traversal.relations;
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
