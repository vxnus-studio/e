import { Pool, PoolConfig } from "pg";
import type {
  Entity,
  Relation,
  Claim,
  Document,
  QueryRequest,
  KnowledgeResult,
  EQueryEngine,
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
        case "resolve": {
          const queryText = `
            SELECT e.* FROM e_entities e
            JOIN e_aliases a ON e.id = a.entity_id
            WHERE a.alias = $1 ${request.namespace ? "AND e.namespace = $2" : ""}
          `;
          const params = request.namespace ? [request.alias, request.namespace] : [request.alias];
          const res = await this.pool.query(queryText, params);
          result.entities = res.rows.map(this.mapEntity);
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
          if (request.limit !== undefined && request.limit <= 0) {
            return result;
          }
          const escapedQuery = request.query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
          const params: any[] = [`%${escapedQuery}%`];
          let queryText = `SELECT * FROM e_entities WHERE (name ILIKE $1 ESCAPE '\\' OR slug ILIKE $1 ESCAPE '\\')`;
          if (request.namespace) {
            params.push(request.namespace);
            queryText += ` AND namespace = $2`;
          }
          queryText += ` ORDER BY id COLLATE "C" ASC`; // deterministic binary ordering
          if (request.limit !== undefined) {
            params.push(request.limit);
            queryText += ` LIMIT $${params.length}`;
          }
          const res = await this.pool.query(queryText, params);
          result.entities = res.rows.map(this.mapEntity);
          break;
        }
        case "traverse": {
          const maxDepth = request.maxDepth !== undefined ? request.maxDepth : DEFAULT_MAX_DEPTH;
          if (maxDepth < 0) {
            break;
          }

          const visited = new Set<string>();
          let frontier: string[] = [request.startId];
          const resultEntities: Entity[] = [];
          let currentDepth = 0;

          visited.add(request.startId);

          while (frontier.length > 0 && currentDepth <= maxDepth) {
            const entRes = await this.pool.query("SELECT * FROM e_entities WHERE id = ANY($1)", [frontier]);
            
            const entMap = new Map<string, Entity>();
            for (const r of entRes.rows) {
              entMap.set(r.id, this.mapEntity(r));
            }
            
            for (const id of frontier) {
              const ent = entMap.get(id);
              if (ent) {
                resultEntities.push(ent);
              }
            }

            if (currentDepth >= maxDepth) {
              break;
            }

            let relQuery = "SELECT * FROM e_relations WHERE subject_id = ANY($1)";
            const relParams: any[] = [frontier];
            
            if (request.predicates && request.predicates.length > 0) {
              relQuery += ` AND predicate = ANY($2)`;
              relParams.push(request.predicates);
            }
            relQuery += ' ORDER BY object_id COLLATE "C" ASC';
            
            const relRes = await this.pool.query(relQuery, relParams);
            
            const edgesBySubject = new Map<string, any[]>();
            for (const edge of relRes.rows) {
              if (!edgesBySubject.has(edge.subject_id)) {
                edgesBySubject.set(edge.subject_id, []);
              }
              edgesBySubject.get(edge.subject_id)!.push(edge);
            }

            const newFrontier: string[] = [];
            for (const parentId of frontier) {
              const outgoing = edgesBySubject.get(parentId) || [];
              for (const edge of outgoing) {
                if (!visited.has(edge.object_id)) {
                  visited.add(edge.object_id);
                  newFrontier.push(edge.object_id);
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
    };
  }

  private mapRelation(row: any): Relation {
    return {
      id: row.id,
      subjectId: row.subject_id,
      predicate: row.predicate,
      objectId: row.object_id,
    };
  }

  private mapClaim(row: any): Claim {
    return {
      id: row.id,
      entityId: row.entity_id,
      statement: row.statement,
      confidence: row.confidence,
      source: row.source,
    };
  }

  private mapDocument(row: any): Document {
    return {
      id: row.id,
      entityId: row.entity_id,
      content: row.content,
    };
  }
}
