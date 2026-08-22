import type {
  Entity,
  Alias,
  Relation,
  Claim,
  Document,
  QueryRequest,
  KnowledgeResult,
  EQueryEngine,
  EFixtureMutator,
  TraversalPath,
  TraversalPathEdge,
} from "./types.js";

import { DEFAULT_MAX_DEPTH, MAX_SAFE_SEARCH_LIMIT, MAX_SAFE_SEARCH_QUERY_LENGTH } from "./types.js";
import { ConstraintError, QueryError, UnsupportedOperationError } from "./errors.js";

export class InMemoryEngine implements EQueryEngine, EFixtureMutator {
  private entities: Map<string, Entity> = new Map();
  private aliases: Alias[] = [];
  private relations: Relation[] = [];
  private claims: Claim[] = [];
  private documents: Document[] = [];

  insertEntity(entity: Entity) {
    if (this.entities.has(entity.id)) {
      throw new ConstraintError(`UNIQUE constraint failed: entity id ${entity.id}`, undefined, "UNIQUE_VIOLATION");
    }
    this.entities.set(entity.id, entity);
  }

  insertAlias(alias: Alias) {
    if (this.aliases.some(a => a.id === alias.id)) {
      throw new ConstraintError(`UNIQUE constraint failed: alias id ${alias.id}`, undefined, "UNIQUE_VIOLATION");
    }
    if (!this.entities.has(alias.entityId)) {
      throw new ConstraintError(`FOREIGN KEY constraint failed: entityId ${alias.entityId} does not exist`, undefined, "FOREIGN_KEY_VIOLATION");
    }
    this.aliases.push(alias);
  }

  insertRelation(relation: Relation) {
    if (this.relations.some(r => r.id === relation.id)) {
      throw new ConstraintError("Relation ID must be unique", undefined, "UNIQUE_VIOLATION");
    }
    if (!this.entities.has(relation.subjectId) || !this.entities.has(relation.objectId)) {
      throw new ConstraintError("FOREIGN KEY constraint failed: subjectId or objectId does not exist", undefined, "FOREIGN_KEY_VIOLATION");
    }
    this.relations.push(relation);
  }

  insertClaim(claim: Claim) {
    if (this.claims.some(c => c.id === claim.id)) {
      throw new ConstraintError(`UNIQUE constraint failed: claim id ${claim.id}`, undefined, "UNIQUE_VIOLATION");
    }
    if (!this.entities.has(claim.entityId)) {
      throw new ConstraintError(`FOREIGN KEY constraint failed: entityId ${claim.entityId} does not exist`, undefined, "FOREIGN_KEY_VIOLATION");
    }
    this.claims.push(claim);
  }

  insertDocument(doc: Document) {
    if (this.documents.some(d => d.id === doc.id)) {
      throw new ConstraintError(`UNIQUE constraint failed: document id ${doc.id}`, undefined, "UNIQUE_VIOLATION");
    }
    if (!this.entities.has(doc.entityId)) {
      throw new ConstraintError(`FOREIGN KEY constraint failed: entityId ${doc.entityId} does not exist`, undefined, "FOREIGN_KEY_VIOLATION");
    }
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

    if (!request || typeof request !== "object") {
      throw new QueryError("QueryRequest must be an object");
    }

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
        const seen = new Set<string>();
        for (const match of matches) {
          const entity = this.entities.get(match.entityId);
          if (
            entity &&
            (!request.namespace || entity.namespace === request.namespace)
          ) {
            if (!seen.has(entity.id)) {
              seen.add(entity.id);
              result.entities!.push(entity);
            }
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
          throw new QueryError("findRelations requires at least subjectId or objectId");
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
        if (!sq || typeof sq !== "object") {
          throw new QueryError("Search query must be an object");
        }
        if (sq.mode && sq.mode !== "lexical") {
          throw new UnsupportedOperationError(`Search mode '${sq.mode}' is not supported by this engine.`);
        }
        if (sq.query && sq.query.length > MAX_SAFE_SEARCH_QUERY_LENGTH) {
          throw new QueryError(`Query length exceeds maximum allowed length of ${MAX_SAFE_SEARCH_QUERY_LENGTH}`);
        }
        if (sq.limit !== undefined) {
          if (!Number.isInteger(sq.limit) || sq.limit < 0) {
            throw new QueryError(`Invalid limit: ${sq.limit}`);
          }
          if (sq.limit === 0) {
            result.search = { entities: [], matches: [] };
            break;
          }
        }
        const effectiveLimit = Math.min(sq.limit ?? MAX_SAFE_SEARCH_LIMIT, MAX_SAFE_SEARCH_LIMIT);
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
        if (result.entities!.length > effectiveLimit) {
          result.entities = result.entities!.slice(0, effectiveLimit);
        }
        
        result.search = {
          entities: result.entities!,
          matches: result.entities!.map(e => ({
            entityId: e.id,
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

        
        let maxDepth = request.maxDepth !== undefined ? request.maxDepth : DEFAULT_MAX_DEPTH;
        if (typeof maxDepth !== 'number' || isNaN(maxDepth) || !Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 100) {
          throw new QueryError("Invalid maxDepth: must be an integer between 0 and 100");
        }
        
        let maxPaths = request.maxPaths !== undefined ? request.maxPaths : 1000;
        if (typeof maxPaths !== 'number' || isNaN(maxPaths) || !Number.isInteger(maxPaths) || maxPaths < 0 || maxPaths > 100000) {
          throw new QueryError("Invalid maxPaths: must be an integer between 0 and 100000");
        }
        if (maxPaths === 0) {
          result.traversal = { entities: [], relations: [], paths: [] };
          result.entities = [];
          result.relations = [];
          break;
        }
        if (maxDepth === 0) {
          result.traversal = { entities: [startEntity], relations: [], paths: [{ startId: request.startId, endId: request.startId, edges: [], depth: 0 }] };
          result.entities = result.traversal.entities;
          result.relations = result.traversal.relations;
          break;
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
        const pathLimit = maxPaths;
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
            if (a.dir !== b.dir) return a.dir < b.dir ? -1 : 1;
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
             if (f.depth > 0 && pathCount < pathLimit) {
                paths.push({
                  startId: request.startId,
                  endId: f.entityId,
                  edges: f.pathEdges,
                  depth: f.depth
                });
                pathCount++;
             }
           }
        }
        
        // Sort paths deterministically
        paths.sort((a, b) => {
          if (a.depth !== b.depth) return a.depth - b.depth;
          const aStr = a.edges.map(e => e.relationId).join(",");
          const bStr = b.edges.map(e => e.relationId).join(",");
          if (aStr !== bStr) return aStr < bStr ? -1 : 1;
          if (a.endId !== b.endId) return a.endId < b.endId ? -1 : 1;
          return 0;
        });

        result.traversal = {
          entities: Array.from(visitedEntities.values()),
          relations: Array.from(visitedRelations.values()),
          paths: paths
        };
        
        if (pathCount >= pathLimit) {
          result.metadata.partial = true;
          result.metadata.warnings = result.metadata.warnings || [];
          result.metadata.warnings.push("Traversal reached maxPaths limit");
        }

        result.entities = result.traversal.entities;
        result.relations = result.traversal.relations;
        break;
      }
      default: {
        const req = request as Record<string, unknown>;
        throw new UnsupportedOperationError(`Unknown query type: ${req.type}`);
      }
    }

    result.metadata.timeMs = Date.now() - startTime;
    return result;
  }
}
