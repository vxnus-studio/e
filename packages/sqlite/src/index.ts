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
  TraversalPath,
  TraversalPathEdge,
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
        data TEXT NOT NULL DEFAULT '{}',
        identities TEXT,
        provenance TEXT,
        temporal TEXT
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
        object_id TEXT NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
        provenance TEXT,
        temporal TEXT,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS e_claims (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
        statement TEXT NOT NULL,
        confidence TEXT NOT NULL CHECK (confidence IN ('canon', 'theory', 'outdated', 'unverified')),
        source TEXT NOT NULL,
        provenance TEXT,
        temporal TEXT
      );

      CREATE TABLE IF NOT EXISTS e_documents (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        provenance TEXT
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
          let queryText = `
            SELECT DISTINCT e.* FROM e_entities e
            JOIN e_aliases a ON e.id = a.entity_id
            WHERE a.alias = ?
          `;
          const params: any[] = [request.alias];
          if (request.namespace) {
            queryText += ` AND e.namespace = ?`;
            params.push(request.namespace);
          }
          const rows = this.db.prepare(queryText).all(params);
          result.entities = rows.map(r => this.mapEntity(r));
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
          result.relations = rows.map(r => this.mapRelation(r));

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
              result.entities = entitiesRes.map(r => this.mapEntity(r));
            }
          }
          break;
        }
        case "findClaims": {
          const rows = this.db.prepare("SELECT * FROM e_claims WHERE entity_id = ?").all(request.entityId);
          result.claims = rows.map(r => this.mapClaim(r));
          break;
        }
        case "findDocuments": {
          const rows = this.db.prepare("SELECT * FROM e_documents WHERE entity_id = ?").all(request.entityId);
          result.documents = rows.map(r => this.mapDocument(r));
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
          const params: any[] = [`%${escapedQuery}%`, `%${escapedQuery}%`];
          let queryText = `SELECT * FROM e_entities WHERE (name LIKE ? ESCAPE '\\' OR slug LIKE ? ESCAPE '\\')`;
          if (sq.namespace) {
            queryText += ` AND namespace = ?`;
            params.push(sq.namespace);
          }
          if (sq.kind) {
            queryText += ` AND kind = ?`;
            params.push(sq.kind);
          }
          queryText += ` ORDER BY id COLLATE BINARY ASC`; // deterministic binary ordering
          if (sq.limit !== undefined) {
            queryText += ` LIMIT ?`;
            params.push(sq.limit);
          }
          const rows = this.db.prepare(queryText).all(params);
          const entities = rows.map(r => this.mapEntity(r));
          result.entities = entities;
          result.search = {
            entities,
            matches: entities.map(e => ({
              entityId: e.id,
              matchReason: "lexical"
            }))
          };
          break;
        }
        case "traverse": {
          const startEntityRow = this.db.prepare("SELECT * FROM e_entities WHERE id = ?").get(request.startId);
          if (!startEntityRow) {
            result.traversal = { entities: [], relations: [], paths: [] };
            break;
          }
          const startEntity = this.mapEntity(startEntityRow);

          let maxDepth = request.maxDepth !== undefined ? request.maxDepth : DEFAULT_MAX_DEPTH;
        if (typeof maxDepth !== 'number' || isNaN(maxDepth) || !Number.isInteger(maxDepth)) maxDepth = DEFAULT_MAX_DEPTH;
        if (maxDepth < 0) maxDepth = 0;
        if (maxDepth > 100) maxDepth = 100;
        
        let maxPaths = request.maxPaths !== undefined ? request.maxPaths : 1000;
        if (typeof maxPaths !== 'number' || isNaN(maxPaths) || !Number.isInteger(maxPaths)) maxPaths = 1000;
        if (maxPaths <= 0) maxPaths = 1000;
        if (maxPaths > 100000) maxPaths = 100000;

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
            const currentLevelItems = [];
            while (frontier.length > 0 && frontier[0].depth === currentDepth) {
              currentLevelItems.push(frontier.shift()!);
            }
            
            if (currentDepth >= maxDepth) {
              for (const item of currentLevelItems) {
                paths.push({
                  startId: request.startId,
                  endId: item.entityId,
                  edges: item.pathEdges,
                  depth: item.depth
                });
                pathCount++;
                if (pathCount >= pathLimit) break;
              }
              continue;
            }

            let stepFilter = steps[currentDepth];
            let allowedDir = stepFilter ? stepFilter.direction : "out";
            let allowedPreds = stepFilter && stepFilter.predicates ? new Set(stepFilter.predicates) : 
                               (request.predicates ? new Set(request.predicates) : null);

            const entityIds = Array.from(new Set(currentLevelItems.map(i => i.entityId)));

            let relations: any[] = [];
            if (entityIds.length > 0) {
              const placeholders = entityIds.map(() => '?').join(',');
              const relParams: any[] = [];
              
              let queryParts = [];
              
              if (allowedDir === "out" || allowedDir === "both") {
                let q = `SELECT 'out' as dir, * FROM e_relations WHERE subject_id IN (${placeholders})`;
                queryParts.push(q);
                relParams.push(...entityIds);
              }
              if (allowedDir === "in" || allowedDir === "both") {
                let q = `SELECT 'in' as dir, * FROM e_relations WHERE object_id IN (${placeholders})`;
                queryParts.push(q);
                relParams.push(...entityIds);
              }

              if (queryParts.length > 0) {
                 const relQuery = queryParts.join(" UNION ALL ");
                 relations = this.db.prepare(relQuery).all(...relParams) as any[];
              }
            }

            if (allowedPreds) {
              relations = relations.filter(r => allowedPreds!.has(r.predicate));
            }

            relations.sort((a, b) => {
              if (a.id !== b.id) return a.id < b.id ? -1 : 1;
              if (a.dir !== b.dir) return a.dir < b.dir ? -1 : 1;
              return 0;
            });

            const missingEntityIds = new Set<string>();
            for (const r of relations) {
              const nextId = r.dir === 'out' ? r.object_id : r.subject_id;
              if (!visitedEntities.has(nextId)) {
                missingEntityIds.add(nextId);
              }
            }

            if (missingEntityIds.size > 0) {
              const ids = Array.from(missingEntityIds);
              const chunkSize = 500;
              for (let i = 0; i < ids.length; i += chunkSize) {
                const chunk = ids.slice(i, i + chunkSize);
                const placeholders = chunk.map(() => '?').join(',');
                const entRows = this.db.prepare(`SELECT * FROM e_entities WHERE id IN (${placeholders})`).all(chunk);
                for (const row of entRows as any[]) {
                  visitedEntities.set(row.id, this.mapEntity(row));
                }
              }
            }

            const edgesBySource = new Map<string, any[]>();
            for (const r of relations) {
              const sourceId = r.dir === 'out' ? r.subject_id : r.object_id;
              if (!edgesBySource.has(sourceId)) {
                edgesBySource.set(sourceId, []);
              }
              edgesBySource.get(sourceId)!.push(r);
            }

            let nextFrontier: FrontierItem[] = [];

            for (const current of currentLevelItems) {
              const outEdges = edgesBySource.get(current.entityId) || [];
              let foundAny = false;

              for (const r of outEdges) {
                if (current.pathEdges.some(pe => pe.relationId === r.id)) {
                  continue;
                }

                const nextId = r.dir === 'out' ? r.object_id : r.subject_id;
                
                if (!visitedEntities.has(nextId)) continue; 

                if (!visitedRelations.has(r.id)) {
                  visitedRelations.set(r.id, this.mapRelation(r));
                }

                const newEdge: TraversalPathEdge = {
                  relationId: r.id,
                  sourceId: r.dir === "out" ? current.entityId : nextId,
                  targetId: r.dir === "out" ? nextId : current.entityId,
                  predicate: r.predicate,
                  direction: r.dir as "out" | "in"
                };

                nextFrontier.push({
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

            frontier.push(...nextFrontier);
          }

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
      data: JSON.parse(row.data || '{}'),
      ...(row.identities ? { identities: JSON.parse(row.identities) } : {}),
      ...(row.provenance ? { provenance: JSON.parse(row.provenance) } : {}),
      ...(row.temporal ? { temporal: JSON.parse(row.temporal) } : {}),
    };
  }

  private mapRelation(row: any): Relation {
    return {
      id: row.id,
      subjectId: row.subject_id,
      predicate: row.predicate,
      objectId: row.object_id,
      ...(row.provenance ? { provenance: JSON.parse(row.provenance) } : {}),
      ...(row.temporal ? { temporal: JSON.parse(row.temporal) } : {}),
      ...(row.metadata ? { metadata: JSON.parse(row.metadata) } : {}),
    };
  }

  private mapClaim(row: any): Claim {
    return {
      id: row.id,
      entityId: row.entity_id,
      statement: row.statement,
      confidence: row.confidence,
      source: row.source,
      ...(row.provenance ? { provenance: JSON.parse(row.provenance) } : {}),
      ...(row.temporal ? { temporal: JSON.parse(row.temporal) } : {}),
    };
  }

  private mapDocument(row: any): Document {
    return {
      id: row.id,
      entityId: row.entity_id,
      content: row.content,
      ...(row.provenance ? { provenance: JSON.parse(row.provenance) } : {}),
    };
  }
}
