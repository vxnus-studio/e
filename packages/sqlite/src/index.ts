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
import { DEFAULT_MAX_DEPTH } from "e";


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
        confidence TEXT NOT NULL CHECK (confidence IN ('canon', 'theory', 'outdated')),
        source TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS e_documents (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
        content TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_e_entities_namespace ON e_entities(namespace);
      CREATE INDEX IF NOT EXISTS idx_e_entities_slug ON e_entities(slug);
      CREATE INDEX IF NOT EXISTS idx_e_aliases_alias ON e_aliases(alias);
      CREATE INDEX IF NOT EXISTS idx_e_aliases_entity_id ON e_aliases(entity_id);
      CREATE INDEX IF NOT EXISTS idx_e_relations_subject_id ON e_relations(subject_id);
      CREATE INDEX IF NOT EXISTS idx_e_relations_object_id ON e_relations(object_id);
      CREATE INDEX IF NOT EXISTS idx_e_relations_predicate ON e_relations(predicate);
      CREATE INDEX IF NOT EXISTS idx_e_claims_entity_id ON e_claims(entity_id);
      CREATE INDEX IF NOT EXISTS idx_e_documents_entity_id ON e_documents(entity_id);
    `);
    this.db.pragma('foreign_keys = ON');
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
          if (!request.subjectId && !request.objectId) {
            throw new Error("findRelations requires at least subjectId or objectId");
          }
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
          if (request.limit !== undefined && request.limit <= 0) {
            return result;
          }
          const escapedQuery = request.query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
          const params: any[] = [`%${escapedQuery}%`, `%${escapedQuery}%`];
          let queryText = `SELECT * FROM e_entities WHERE (name LIKE ? ESCAPE '\\' OR slug LIKE ? ESCAPE '\\')`;
          if (request.namespace) {
            queryText += ` AND namespace = ?`;
            params.push(request.namespace);
          }
          queryText += ` ORDER BY id COLLATE BINARY ASC`; // deterministic binary ordering
          if (request.limit !== undefined) {
            queryText += ` LIMIT ?`;
            params.push(request.limit);
          }
          const rows = this.db.prepare(queryText).all(params);
          result.entities = rows.map(this.mapEntity);
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
            const placeholders = frontier.map(() => '?').join(',');
            const entRows = this.db.prepare(`SELECT * FROM e_entities WHERE id IN (${placeholders})`).all(...frontier) as any[];
            
            const entMap = new Map<string, Entity>();
            for (const r of entRows) {
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

            let relQuery = `SELECT * FROM e_relations WHERE subject_id IN (${placeholders})`;
            const relParams: any[] = [...frontier];
            
            if (request.predicates && request.predicates.length > 0) {
              const predPlaceholders = request.predicates.map(() => '?').join(',');
              relQuery += ` AND predicate IN (${predPlaceholders})`;
              relParams.push(...request.predicates);
            }
            relQuery += ` ORDER BY object_id COLLATE BINARY ASC`;
            
            const edges = this.db.prepare(relQuery).all(...relParams) as any[];
            
            const edgesBySubject = new Map<string, any[]>();
            for (const edge of edges) {
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
