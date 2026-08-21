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
        case "search": {
          const params: any[] = [`%${request.query}%`];
          let queryText = `SELECT * FROM e_entities WHERE (name ILIKE $1 OR slug ILIKE $1)`;
          if (request.namespace) {
            params.push(request.namespace);
            queryText += ` AND namespace = $2`;
          }
          if (request.limit) {
            params.push(request.limit);
            queryText += ` LIMIT $${params.length}`;
          }
          const res = await this.pool.query(queryText, params);
          result.entities = res.rows.map(this.mapEntity);
          break;
        }
        case "traverse": {
          result.metadata.warnings = ["Traverse is not fully implemented in PostgresEngine"];
          break;
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
}
