import { Pool, PoolConfig } from "pg";
import type {
  Entity,
  Relation,
  Claim,
  Document,
  QueryRequest,
  KnowledgeResult,
  EQueryEngine,
  TraversalPath,
  TraversalPathEdge,
} from "e";
import { DEFAULT_MAX_DEPTH } from "e";


export class PostgresEngine implements EQueryEngine {
  private pool: Pool;

  constructor(config: PoolConfig) {
    this.pool = new Pool(config);
  }

  async close() {
    await this.pool.end();
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

    try {
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
          const queryText = `
            SELECT DISTINCT e.* FROM e_entities e
            JOIN e_aliases a ON e.id = a.entity_id
            WHERE a.alias = $1 ${request.namespace ? "AND e.namespace = $2" : ""}
          `;
          const params = request.namespace ? [request.alias, request.namespace] : [request.alias];
          const res = await this.pool.query(queryText, params);
          result.entities = res.rows.map((row) => this.mapEntity(row));
          break;
        }
        case "getEntity": {
          const res = await this.pool.query("SELECT * FROM e_entities WHERE id = $1", [request.id]);
          if (res.rows.length > 0) {
            result.entities = [this.mapEntity(res.rows[0])];
          }
          break;
        }
        case "findRelations": {
          if (!request.subjectId && !request.objectId) {
            throw new Error("findRelations requires at least subjectId or objectId");
          }
          let queryText = "SELECT * FROM e_relations WHERE 1=1";
          const params: any[] = [];
          
          if (request.subjectId) {
            params.push(request.subjectId);
            queryText += ` AND subject_id = $${params.length}`;
          }
          if (request.objectId) {
            params.push(request.objectId);
            queryText += ` AND object_id = $${params.length}`;
          }
          if (request.predicate) {
            params.push(request.predicate);
            queryText += ` AND predicate = $${params.length}`;
          }

          const res = await this.pool.query(queryText, params);
          result.relations = res.rows.map(this.mapRelation);

          if (result.relations.length > 0) {
            const entityIds = new Set<string>();
            for (const r of result.relations) {
              entityIds.add(r.subjectId);
              entityIds.add(r.objectId);
            }
            if (entityIds.size > 0) {
              const entitiesRes = await this.pool.query(
                `SELECT * FROM e_entities WHERE id = ANY($1::varchar[])`,
                [Array.from(entityIds)]
              );
              result.entities = entitiesRes.rows.map(this.mapEntity);
            }
          }
          break;
        }
        case "findClaims": {
          const res = await this.pool.query("SELECT * FROM e_claims WHERE entity_id = $1", [request.entityId]);
          result.claims = res.rows.map(this.mapClaim);
          break;
        }
        case "findDocuments": {
          const res = await this.pool.query("SELECT * FROM e_documents WHERE entity_id = $1", [request.entityId]);
          result.documents = res.rows.map(this.mapDocument);
          break;
        }
        case "search": {
          const sq = request.search;
          if (sq.mode && sq.mode !== "lexical") {
            throw new Error(`Search mode '${sq.mode}' is not supported by this engine.`);
          }
          if (sq.limit !== undefined && sq.limit <= 0) {
            result.search = { entities: [], matches: [] };
            break;
          }
          const escapedQuery = sq.query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
          const params: any[] = [`%${escapedQuery}%`];
          let queryText = `SELECT * FROM e_entities WHERE (name ILIKE $1 ESCAPE '\\' OR slug ILIKE $1 ESCAPE '\\')`;
          if (sq.namespace) {
            params.push(sq.namespace);
            queryText += ` AND namespace = $${params.length}`;
          }
          if (sq.kind) {
            params.push(sq.kind);
            queryText += ` AND kind = $${params.length}`;
          }
          queryText += ` ORDER BY id COLLATE "C" ASC`; // deterministic binary ordering
          if (sq.limit !== undefined) {
            params.push(sq.limit);
            queryText += ` LIMIT $${params.length}`;
          }
          const res = await this.pool.query(queryText, params);
          const entities = res.rows.map((row) => this.mapEntity(row));
          result.search = {
            entities,
            matches: entities.map(e => ({
              entityId: e.id,
              matchReason: "lexical"
            }))
          };
          result.entities = entities;
          break;
        }
        case "traverse": {
          let maxDepth = request.maxDepth !== undefined ? request.maxDepth : DEFAULT_MAX_DEPTH;
        if (typeof maxDepth !== 'number' || isNaN(maxDepth) || !Number.isInteger(maxDepth)) maxDepth = DEFAULT_MAX_DEPTH;
        if (maxDepth < 0) maxDepth = 0;
        if (maxDepth > 100) maxDepth = 100;
        
        let maxPaths = request.maxPaths !== undefined ? request.maxPaths : 1000;
        if (typeof maxPaths !== 'number' || isNaN(maxPaths) || maxPaths <= 0 || !Number.isInteger(maxPaths)) maxPaths = 1000;
        if (maxPaths > 100000) maxPaths = 100000;

          const startRes = await this.pool.query("SELECT * FROM e_entities WHERE id = $1", [request.startId]);
          if (startRes.rows.length === 0) {
            result.traversal = { entities: [], relations: [], paths: [] };
            break;
          }
          const startEntity = this.mapEntity(startRes.rows[0]);

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
          const pathLimit = request.maxPaths !== undefined ? request.maxPaths : 1000;
          let pathCount = 0;

          while (frontier.length > 0 && pathCount < pathLimit) {
            const currentDepth = frontier[0].depth;
            const currentLevelItems: FrontierItem[] = [];
            while (frontier.length > 0 && frontier[0].depth === currentDepth) {
              currentLevelItems.push(frontier.shift()!);
            }

            if (currentDepth >= maxDepth) {
              for (const item of currentLevelItems) {
                if (pathCount < pathLimit) {
                  paths.push({
                    startId: request.startId,
                    endId: item.entityId,
                    edges: item.pathEdges,
                    depth: item.depth
                  });
                  pathCount++;
                }
              }
              continue;
            }

            let stepFilter = steps[currentDepth];
            let allowedDir = stepFilter ? stepFilter.direction : "out";
            let allowedPreds = stepFilter && stepFilter.predicates ? new Set(stepFilter.predicates) : 
                                 (request.predicates ? new Set(request.predicates) : null);

            const entityIds = Array.from(new Set(currentLevelItems.map(i => i.entityId)));
            let allEdges: { r: Relation, dir: "out" | "in" }[] = [];

            if (entityIds.length > 0) {
              const queries = [];
              if (allowedDir === "out" || allowedDir === "both") {
                let q = "SELECT * FROM e_relations WHERE subject_id = ANY($1)";
                const p: any[] = [entityIds];
                if (allowedPreds) {
                  q += " AND predicate = ANY($2)";
                  p.push(Array.from(allowedPreds));
                }
                queries.push(this.pool.query(q, p).then(r => r.rows.map(row => ({ r: this.mapRelation(row), dir: "out" as const }))));
              }
              if (allowedDir === "in" || allowedDir === "both") {
                let q = "SELECT * FROM e_relations WHERE object_id = ANY($1)";
                const p: any[] = [entityIds];
                if (allowedPreds) {
                  q += " AND predicate = ANY($2)";
                  p.push(Array.from(allowedPreds));
                }
                queries.push(this.pool.query(q, p).then(r => r.rows.map(row => ({ r: this.mapRelation(row), dir: "in" as const }))));
              }
              const results = await Promise.all(queries);
              for (const res of results) {
                allEdges = allEdges.concat(res);
              }

              // Deterministic sort
              allEdges.sort((a, b) => {
                if (a.r.id !== b.r.id) return a.r.id < b.r.id ? -1 : 1;
                if (a.dir !== b.dir) return a.dir < b.dir ? -1 : 1;
                return 0;
              });
            }

            const nextEntityIds = new Set<string>();
            for (const { r, dir } of allEdges) {
              const nextId = dir === "out" ? r.objectId : r.subjectId;
              if (!visitedEntities.has(nextId)) {
                nextEntityIds.add(nextId);
              }
              visitedRelations.set(r.id, r);
            }

            if (nextEntityIds.size > 0) {
              const nextEntsRes = await this.pool.query("SELECT * FROM e_entities WHERE id = ANY($1)", [Array.from(nextEntityIds)]);
              for (const row of nextEntsRes.rows) {
                const ent = this.mapEntity(row);
                visitedEntities.set(ent.id, ent);
              }
            }

            for (const current of currentLevelItems) {
              let foundAny = false;
              const relevantEdges = allEdges.filter(e =>
                (e.dir === "out" && e.r.subjectId === current.entityId) ||
                (e.dir === "in" && e.r.objectId === current.entityId)
              );

              for (const { r, dir } of relevantEdges) {
                if (current.pathEdges.some(pe => pe.relationId === r.id)) {
                  continue;
                }

                const nextId = dir === "out" ? r.objectId : r.subjectId;
                if (!visitedEntities.has(nextId)) continue;

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

              if (!foundAny && current.depth > 0 && pathCount < pathLimit) {
                paths.push({
                  startId: request.startId,
                  endId: current.entityId,
                  edges: current.pathEdges,
                  depth: current.depth
                });
                pathCount++;
              }
            }
          }

          if (frontier.length > 0) {
            for (const f of frontier) {
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

          paths.sort((a, b) => {
            if (a.depth !== b.depth) return a.depth - b.depth;
            const aStr = a.edges.map((e: any) => e.relationId).join(",");
            const bStr = b.edges.map((e: any) => e.relationId).join(",");
            if (aStr !== bStr) return aStr < bStr ? -1 : 1;
            if (a.endId !== b.endId) return a.endId < b.endId ? -1 : 1;
            return 0;
          });

          result.traversal = {
            entities: Array.from(visitedEntities.values()),
            relations: Array.from(visitedRelations.values()),
            paths
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
          throw new Error(`Unknown query type: ${(request as any).type}`);
        }
      }
    } catch (e: any) {
      throw e;
    }

    result.metadata.timeMs = Date.now() - startTime;
    return result;
  }

  private mapEntity(row: any): Entity {
    return {
      id: row.id,
      namespace: row.namespace,
      kind: row.kind,
      slug: row.slug,
      name: row.name,
      data: row.data || {},
      identities: row.identities || undefined,
      provenance: row.provenance || undefined,
      temporal: row.temporal || undefined,
    };
  }

  private mapRelation(row: any): Relation {
    return {
      id: row.id,
      subjectId: row.subject_id,
      predicate: row.predicate,
      objectId: row.object_id,
      provenance: row.provenance || undefined,
      temporal: row.temporal || undefined,
      metadata: row.metadata || undefined,
    };
  }

  private mapClaim(row: any): Claim {
    return {
      id: row.id,
      entityId: row.entity_id,
      statement: row.statement,
      confidence: row.confidence,
      source: row.source,
      provenance: row.provenance || undefined,
      temporal: row.temporal || undefined,
    };
  }

  private mapDocument(row: any): Document {
    return {
      id: row.id,
      entityId: row.entity_id,
      content: row.content,
      provenance: row.provenance || undefined,
    };
  }
}
