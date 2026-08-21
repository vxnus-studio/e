import Database from "better-sqlite3";
import type { Database as SqliteDatabase } from "better-sqlite3";
import type {
  Entity,
  Relation,
  Claim,
  Document,
  QueryRequest,
  KnowledgeResult,
  EQueryEngine,
} from "e";

export class SqliteEngine implements EQueryEngine {
  private db: SqliteDatabase;

  constructor(filename: string, options?: Database.Options) {
    this.db = new Database(filename, options);
    this.initSchema();
  }
  
  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS e_entities (
        id TEXT PRIMARY KEY,
        namespace TEXT NOT NULL,
        kind TEXT NOT NULL,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        data TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS e_aliases (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
        alias TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS e_relations (
        id TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
        predicate TEXT NOT NULL,
        object_id TEXT NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS e_claims (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
        statement TEXT NOT NULL,
        confidence TEXT NOT NULL,
        source TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS e_documents (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
        content TEXT NOT NULL
      );
    `);
  }

  close() {
    this.db.close();
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
          let queryText = `
            SELECT e.* FROM e_entities e
            JOIN e_aliases a ON e.id = a.entity_id
            WHERE a.alias = ?
          `;
          const params: any[] = [request.alias];
          if (request.namespace) {
            queryText += ` AND e.namespace = ?`;
            params.push(request.namespace);
          }
          const rows = this.db.prepare(queryText).all(params);
          result.entities = rows.map(this.mapEntity);
          break;
        }
        case "getEntity": {
          const row = this.db.prepare("SELECT * FROM e_entities WHERE id = ?").get(request.id);
          if (row) {
            result.entities = [this.mapEntity(row)];
          }
          break;
        }
        case "findRelations": {
          let queryText = "SELECT * FROM e_relations WHERE 1=1";
          const params: any[] = [];
          
          if (request.subjectId) {
            queryText += ` AND subject_id = ?`;
            params.push(request.subjectId);
          }
          if (request.objectId) {
            queryText += ` AND object_id = ?`;
            params.push(request.objectId);
          }
          if (request.predicate) {
            queryText += ` AND predicate = ?`;
            params.push(request.predicate);
          }

          const rows = this.db.prepare(queryText).all(params);
          result.relations = rows.map(this.mapRelation);

          if (result.relations.length > 0) {
            const entityIds = new Set<string>();
            for (const r of result.relations) {
              entityIds.add(r.subjectId);
              entityIds.add(r.objectId);
            }
            if (entityIds.size > 0) {
              const placeholders = Array.from(entityIds).map(() => "?").join(",");
              const entitiesRes = this.db.prepare(
                `SELECT * FROM e_entities WHERE id IN (${placeholders})`
              ).all(Array.from(entityIds));
              result.entities = entitiesRes.map(this.mapEntity);
            }
          }
          break;
        }
        case "findClaims": {
          const rows = this.db.prepare("SELECT * FROM e_claims WHERE entity_id = ?").all(request.entityId);
          result.claims = rows.map(this.mapClaim);
          break;
        }
        case "findDocuments": {
          const rows = this.db.prepare("SELECT * FROM e_documents WHERE entity_id = ?").all(request.entityId);
          result.documents = rows.map(this.mapDocument);
          break;
        }
        case "search": {
          const params: any[] = [`%${request.query}%`, `%${request.query}%`];
          let queryText = `SELECT * FROM e_entities WHERE (name LIKE ? OR slug LIKE ?)`;
          if (request.namespace) {
            queryText += ` AND namespace = ?`;
            params.push(request.namespace);
          }
          queryText += ` ORDER BY id ASC`; // deterministic ordering
          if (request.limit) {
            queryText += ` LIMIT ?`;
            params.push(request.limit);
          }
          const rows = this.db.prepare(queryText).all(params);
          result.entities = rows.map(this.mapEntity);
          break;
        }
        case "traverse": {
          result.metadata.warnings = ["Traverse is not fully implemented in SqliteEngine"];
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
      data: JSON.parse(row.data || '{}'),
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
