import Database from "better-sqlite3";
import type { Database as SqliteDatabase } from "better-sqlite3";
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
  EBatchMutator,
  BatchDataset,
  BatchIngestResult,
  TraversalPath,
  TraversalPathEdge,
} from "@vxnus/e";
import {
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_PATHS,
  DEFAULT_MAX_RELATIONS_EXPANDED,
  DEFAULT_MAX_ENTITIES_HYDRATED,
  MAX_SAFE_DEPTH,
  MAX_SAFE_PATHS,
  ConstraintError,
  QueryError,
  StorageError,
  UnsupportedOperationError,
  MAX_SAFE_SEARCH_LIMIT,
  MAX_SAFE_SEARCH_QUERY_LENGTH,
  validateEntity,
  validateAlias,
  validateRelation,
  validateClaim,
  validateDocument,
  validateBatchDataset,
  validateQueryRequest,
} from "@vxnus/e";

export class SqliteEngine implements EQueryEngine, EFixtureMutator, EBatchMutator {
  private db: SqliteDatabase;

  constructor(filename: string, options?: Database.Options) {
    this.db = new Database(filename, options);
    this.initSchema();
  }
  
  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS e_entities (
        id TEXT PRIMARY KEY CHECK (length(id) <= 255),
        namespace TEXT NOT NULL CHECK (length(namespace) <= 255),
        kind TEXT NOT NULL CHECK (length(kind) <= 255),
        slug TEXT NOT NULL CHECK (length(slug) <= 255),
        name TEXT NOT NULL CHECK (length(name) <= 255),
        data TEXT NOT NULL DEFAULT '{}',
        identities TEXT,
        provenance TEXT,
        temporal TEXT
      );

      CREATE TABLE IF NOT EXISTS e_aliases (
        id TEXT PRIMARY KEY CHECK (length(id) <= 255),
        entity_id TEXT NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
        alias TEXT NOT NULL CHECK (length(alias) <= 255)
      );

      CREATE TABLE IF NOT EXISTS e_relations (
        id TEXT PRIMARY KEY CHECK (length(id) <= 255),
        subject_id TEXT NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
        predicate TEXT NOT NULL CHECK (length(predicate) <= 255),
        object_id TEXT NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
        provenance TEXT,
        temporal TEXT,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS e_claims (
        id TEXT PRIMARY KEY CHECK (length(id) <= 255),
        entity_id TEXT NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
        statement TEXT NOT NULL,
        confidence TEXT NOT NULL CHECK (confidence IN ('canon', 'theory', 'outdated', 'unverified')),
        source TEXT NOT NULL CHECK (length(source) <= 255),
        provenance TEXT,
        temporal TEXT
      );

      CREATE TABLE IF NOT EXISTS e_documents (
        id TEXT PRIMARY KEY CHECK (length(id) <= 255),
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
    validateQueryRequest(request);
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
          if (!request.alias || typeof request.alias !== "string") {
            throw new QueryError("Invalid alias: must be a non-empty string");
          }
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
          queryText += ` ORDER BY e.id COLLATE BINARY ASC`;
          const rows = this.db.prepare(queryText).all(params);
          result.entities = rows.map(r => this.mapEntity(r));
          break;
        }
        case "getEntity": {
          if (!request.id || typeof request.id !== "string") {
            throw new QueryError("Invalid id: must be a non-empty string");
          }
          const row = this.db.prepare("SELECT * FROM e_entities WHERE id = ?").get(request.id);
          if (row) {
            result.entities = [this.mapEntity(row)];
          }
          break;
        }
        case "findRelations": {
          if (!request.subjectId && !request.objectId) {
            throw new QueryError("findRelations requires at least subjectId or objectId");
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

          queryText += ` ORDER BY id COLLATE BINARY ASC`;
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
                `SELECT * FROM e_entities WHERE id IN (${placeholders}) ORDER BY id COLLATE BINARY ASC`
              ).all(Array.from(entityIds));
              result.entities = entitiesRes.map(r => this.mapEntity(r));
            }
          }
          break;
        }
        case "findClaims": {
          if (!request.entityId || typeof request.entityId !== "string") {
            throw new QueryError("Invalid entityId: must be a non-empty string");
          }
          const rows = this.db.prepare("SELECT * FROM e_claims WHERE entity_id = ? ORDER BY id COLLATE BINARY ASC").all(request.entityId);
          result.claims = rows.map(r => this.mapClaim(r));
          break;
        }
        case "findDocuments": {
          if (!request.entityId || typeof request.entityId !== "string") {
            throw new QueryError("Invalid entityId: must be a non-empty string");
          }
          const rows = this.db.prepare("SELECT * FROM e_documents WHERE entity_id = ? ORDER BY id COLLATE BINARY ASC").all(request.entityId);
          result.documents = rows.map(r => this.mapDocument(r));
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
          queryText += ` LIMIT ?`;
          params.push(effectiveLimit);
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
          let maxDepth = request.maxDepth !== undefined ? request.maxDepth : DEFAULT_MAX_DEPTH;
          if (typeof maxDepth !== 'number' || isNaN(maxDepth) || !Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > MAX_SAFE_DEPTH) {
            throw new QueryError(`Invalid maxDepth: must be an integer between 0 and ${MAX_SAFE_DEPTH}`);
          }
          
          let maxPaths = request.maxPaths !== undefined ? request.maxPaths : DEFAULT_MAX_PATHS;
          if (typeof maxPaths !== 'number' || isNaN(maxPaths) || !Number.isInteger(maxPaths) || maxPaths < 0 || maxPaths > MAX_SAFE_PATHS) {
            throw new QueryError(`Invalid maxPaths: must be an integer between 0 and ${MAX_SAFE_PATHS}`);
          }

          const maxRelationsExpanded = request.maxRelationsExpanded !== undefined
            ? request.maxRelationsExpanded
            : DEFAULT_MAX_RELATIONS_EXPANDED;
          if (typeof maxRelationsExpanded !== 'number' || isNaN(maxRelationsExpanded) || !Number.isInteger(maxRelationsExpanded) || maxRelationsExpanded < 0) {
            throw new QueryError("Invalid maxRelationsExpanded: must be a non-negative integer");
          }

          const maxEntitiesHydrated = request.maxEntitiesHydrated !== undefined
            ? request.maxEntitiesHydrated
            : DEFAULT_MAX_ENTITIES_HYDRATED;
          if (typeof maxEntitiesHydrated !== 'number' || isNaN(maxEntitiesHydrated) || !Number.isInteger(maxEntitiesHydrated) || maxEntitiesHydrated < 0) {
            throw new QueryError("Invalid maxEntitiesHydrated: must be a non-negative integer");
          }

          if (maxPaths === 0) {
            result.traversal = { entities: [], relations: [], paths: [] };
            result.entities = [];
            result.relations = [];
            break;
          }

          const startEntityRow = this.db.prepare("SELECT * FROM e_entities WHERE id = ?").get(request.startId);
          if (!startEntityRow) {
            result.traversal = { entities: [], relations: [], paths: [] };
            break;
          }
          const startEntity = this.mapEntity(startEntityRow);

          if (maxDepth === 0) {
            result.traversal = { entities: [startEntity], relations: [], paths: [{ startId: request.startId, endId: request.startId, edges: [], depth: 0 }] };
            result.entities = result.traversal.entities;
            result.relations = result.traversal.relations;
            break;
          }

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
          const pathLimit = maxPaths;
          let pathCount = 0;
          let totalRelationsExpanded = 0;
          let truncationOccurred = false;
          const truncationReasons: string[] = [];

          while (frontier.length > 0 && pathCount < pathLimit) {
            const currentDepth = frontier[0].depth;
            const currentLevelItems = [];
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
                } else {
                  truncationOccurred = true;
                  if (!truncationReasons.includes("maxPaths limit reached")) {
                    truncationReasons.push("maxPaths limit reached");
                  }
                }
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
              const remainingRelationBudget = Math.max(0, maxRelationsExpanded - totalRelationsExpanded);
              if (remainingRelationBudget <= 0) {
                truncationOccurred = true;
                if (!truncationReasons.includes("maxRelationsExpanded limit reached")) {
                  truncationReasons.push("maxRelationsExpanded limit reached");
                }
                break;
              }

              const dbFetchLimit = remainingRelationBudget + 1;
              const chunkSize = 500;
              for (let i = 0; i < entityIds.length; i += chunkSize) {
                const chunk = entityIds.slice(i, i + chunkSize);
                const placeholders = chunk.map(() => '?').join(',');
                const relParams: any[] = [];
                let queryParts = [];
                
                let predClause = "";
                let predParams: string[] = [];
                if (allowedPreds) {
                  predParams = Array.from(allowedPreds);
                  const predPlaceholders = predParams.map(() => '?').join(',');
                  predClause = ` AND predicate IN (${predPlaceholders})`;
                }

                if (allowedDir === "out" || allowedDir === "both") {
                  let q = `SELECT 'out' as dir, * FROM e_relations WHERE subject_id IN (${placeholders})${predClause}`;
                  queryParts.push(q);
                  relParams.push(...chunk, ...predParams);
                }
                if (allowedDir === "in" || allowedDir === "both") {
                  let q = `SELECT 'in' as dir, * FROM e_relations WHERE object_id IN (${placeholders})${predClause}`;
                  queryParts.push(q);
                  relParams.push(...chunk, ...predParams);
                }

                if (queryParts.length > 0) {
                   const relQuery = `${queryParts.join(" UNION ALL ")} ORDER BY id COLLATE BINARY ASC, dir ASC LIMIT ?`;
                   relParams.push(dbFetchLimit);
                   const chunkRelations = this.db.prepare(relQuery).all(...relParams) as Record<string, any>[];
                   relations.push(...chunkRelations);
                   if (relations.length > remainingRelationBudget) {
                     break;
                   }
                }
              }
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
              const remainingEntityBudget = Math.max(0, maxEntitiesHydrated - visitedEntities.size);
              if (remainingEntityBudget <= 0) {
                truncationOccurred = true;
                if (!truncationReasons.includes("maxEntitiesHydrated limit reached")) {
                  truncationReasons.push("maxEntitiesHydrated limit reached");
                }
              } else {
                const ids = Array.from(missingEntityIds).slice(0, remainingEntityBudget);
                if (ids.length < missingEntityIds.size) {
                  truncationOccurred = true;
                  if (!truncationReasons.includes("maxEntitiesHydrated limit reached")) {
                    truncationReasons.push("maxEntitiesHydrated limit reached");
                  }
                }
                const chunkSize = 500;
                for (let i = 0; i < ids.length; i += chunkSize) {
                  const chunk = ids.slice(i, i + chunkSize);
                  const placeholders = chunk.map(() => '?').join(',');
                  const entRows = this.db.prepare(`SELECT * FROM e_entities WHERE id IN (${placeholders})`).all(chunk);
                  for (const row of entRows as Record<string, any>[]) {
                    visitedEntities.set(row.id, this.mapEntity(row));
                  }
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
              if (pathCount >= pathLimit) {
                truncationOccurred = true;
                break;
              }

              const outEdges = edgesBySource.get(current.entityId) || [];
              let foundAny = false;

              for (const r of outEdges) {
                if (totalRelationsExpanded >= maxRelationsExpanded) {
                  truncationOccurred = true;
                  if (!truncationReasons.includes("maxRelationsExpanded limit reached")) {
                    truncationReasons.push("maxRelationsExpanded limit reached");
                  }
                  break;
                }
                totalRelationsExpanded++;

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

                if (nextFrontier.length < pathLimit) {
                  nextFrontier.push({
                    entityId: nextId,
                    pathEdges: [...current.pathEdges, newEdge],
                    depth: current.depth + 1
                  });
                } else {
                  truncationOccurred = true;
                  if (!truncationReasons.includes("maxPaths limit reached")) {
                    truncationReasons.push("maxPaths limit reached");
                  }
                }
                foundAny = true;
              }

              if (!foundAny && current.depth > 0) {
                if (pathCount < pathLimit) {
                  paths.push({
                    startId: request.startId,
                    endId: current.entityId,
                    edges: current.pathEdges,
                    depth: current.depth
                  });
                  pathCount++;
                } else {
                  truncationOccurred = true;
                  if (!truncationReasons.includes("maxPaths limit reached")) {
                    truncationReasons.push("maxPaths limit reached");
                  }
                }
              }
            }

            for (const item of nextFrontier) {
              frontier.push(item);
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
              } else if (f.depth > 0) {
                truncationOccurred = true;
                if (!truncationReasons.includes("maxPaths limit reached")) {
                  truncationReasons.push("maxPaths limit reached");
                }
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
          if (truncationOccurred) {
            if (!result.metadata) result.metadata = { timeMs: 0 };
            result.metadata.partial = true;
            result.metadata.warnings = result.metadata.warnings || [];
            for (const reason of truncationReasons) {
              result.metadata.warnings.push(`Traversal truncated: ${reason}`);
            }
            if (truncationReasons.length === 0 || truncationReasons.includes("maxPaths limit reached")) {
              result.metadata.warnings.push("Traversal reached maxPaths limit");
            }
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
    } catch (e: any) {
      if (e instanceof QueryError || e instanceof UnsupportedOperationError || e instanceof ConstraintError || e instanceof StorageError) {
        throw e;
      }
      throw new StorageError(e instanceof Error ? e.message : "SQLite storage failure", e);
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
      data: JSON.parse(row.data || "{}"),
      identities: row.identities ? JSON.parse(row.identities) : undefined,
      provenance: row.provenance ? JSON.parse(row.provenance) : undefined,
      temporal: row.temporal ? JSON.parse(row.temporal) : undefined,
    };
  }

  private mapRelation(row: any): Relation {
    return {
      id: row.id,
      subjectId: row.subject_id,
      predicate: row.predicate,
      objectId: row.object_id,
      provenance: row.provenance ? JSON.parse(row.provenance) : undefined,
      temporal: row.temporal ? JSON.parse(row.temporal) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  private mapClaim(row: any): Claim {
    return {
      id: row.id,
      entityId: row.entity_id,
      statement: row.statement,
      confidence: row.confidence,
      source: row.source,
      provenance: row.provenance ? JSON.parse(row.provenance) : undefined,
      temporal: row.temporal ? JSON.parse(row.temporal) : undefined,
    };
  }

  private mapDocument(row: any): Document {
    return {
      id: row.id,
      entityId: row.entity_id,
      content: row.content,
      provenance: row.provenance ? JSON.parse(row.provenance) : undefined,
    };
  }

  // --- EFixtureMutator Implementation ---
  private handleSqliteError(e: any): never {
    if (e.message.includes("UNIQUE constraint failed") || e.message.includes("FOREIGN KEY constraint failed") || e.message.includes("CHECK constraint failed")) {
      throw new ConstraintError(e.message, e);
    }
    throw new StorageError(e instanceof Error ? e.message : "SQLite storage failure", e);
  }

  insertEntity(entity: Entity): void {
    validateEntity(entity);
    try {
      this.db.prepare(`
        INSERT INTO e_entities (id, namespace, kind, slug, name, data, identities, provenance, temporal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        entity.id,
        entity.namespace,
        entity.kind,
        entity.slug,
        entity.name,
        JSON.stringify(entity.data || {}),
        entity.identities !== undefined ? JSON.stringify(entity.identities) : null,
        entity.provenance !== undefined ? JSON.stringify(entity.provenance) : null,
        entity.temporal !== undefined ? JSON.stringify(entity.temporal) : null
      );
    } catch (e: any) { this.handleSqliteError(e); }
  }

  insertAlias(alias: Alias): void {
    validateAlias(alias);
    try {
      this.db.prepare("INSERT INTO e_aliases (id, entity_id, alias) VALUES (?, ?, ?)").run(
        alias.id, alias.entityId, alias.alias
      );
    } catch (e: any) { this.handleSqliteError(e); }
  }

  insertRelation(relation: Relation): void {
    validateRelation(relation);
    try {
      this.db.prepare(`
        INSERT INTO e_relations (id, subject_id, predicate, object_id, provenance, temporal, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        relation.id,
        relation.subjectId,
        relation.predicate,
        relation.objectId,
        relation.provenance !== undefined ? JSON.stringify(relation.provenance) : null,
        relation.temporal !== undefined ? JSON.stringify(relation.temporal) : null,
        relation.metadata !== undefined ? JSON.stringify(relation.metadata) : null
      );
    } catch (e: any) { this.handleSqliteError(e); }
  }

  insertClaim(claim: Claim): void {
    validateClaim(claim);
    try {
      this.db.prepare(`
        INSERT INTO e_claims (id, entity_id, statement, confidence, source, provenance, temporal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        claim.id,
        claim.entityId,
        claim.statement,
        claim.confidence,
        claim.source,
        claim.provenance !== undefined ? JSON.stringify(claim.provenance) : null,
        claim.temporal !== undefined ? JSON.stringify(claim.temporal) : null
      );
    } catch (e: any) { this.handleSqliteError(e); }
  }

  insertDocument(doc: Document): void {
    validateDocument(doc);
    try {
      this.db.prepare(`
        INSERT INTO e_documents (id, entity_id, content, provenance)
        VALUES (?, ?, ?, ?)
      `).run(
        doc.id,
        doc.entityId,
        doc.content,
        doc.provenance !== undefined ? JSON.stringify(doc.provenance) : null
      );
    } catch (e: any) { this.handleSqliteError(e); }
  }

  // --- EBatchMutator Implementation (Atomic Transactions) ---
  async ingestBatch(dataset: BatchDataset): Promise<BatchIngestResult> {
    validateBatchDataset(dataset);
    const startTime = Date.now();
    const insertEntityStmt = this.db.prepare(`
      INSERT INTO e_entities (id, namespace, kind, slug, name, data, identities, provenance, temporal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertAliasStmt = this.db.prepare("INSERT INTO e_aliases (id, entity_id, alias) VALUES (?, ?, ?)");
    const insertRelationStmt = this.db.prepare(`
      INSERT INTO e_relations (id, subject_id, predicate, object_id, provenance, temporal, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertClaimStmt = this.db.prepare(`
      INSERT INTO e_claims (id, entity_id, statement, confidence, source, provenance, temporal)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertDocumentStmt = this.db.prepare(`
      INSERT INTO e_documents (id, entity_id, content, provenance)
      VALUES (?, ?, ?, ?)
    `);

    const runTx = this.db.transaction(() => {
      let entitiesCount = 0;
      let aliasesCount = 0;
      let relationsCount = 0;
      let claimsCount = 0;
      let documentsCount = 0;

      for (const entity of dataset.entities || []) {
        insertEntityStmt.run(
          entity.id,
          entity.namespace,
          entity.kind,
          entity.slug,
          entity.name,
          JSON.stringify(entity.data || {}),
          entity.identities !== undefined ? JSON.stringify(entity.identities) : null,
          entity.provenance !== undefined ? JSON.stringify(entity.provenance) : null,
          entity.temporal !== undefined ? JSON.stringify(entity.temporal) : null
        );
        entitiesCount++;
      }

      for (const alias of dataset.aliases || []) {
        insertAliasStmt.run(alias.id, alias.entityId, alias.alias);
        aliasesCount++;
      }

      for (const relation of dataset.relations || []) {
        insertRelationStmt.run(
          relation.id,
          relation.subjectId,
          relation.predicate,
          relation.objectId,
          relation.provenance !== undefined ? JSON.stringify(relation.provenance) : null,
          relation.temporal !== undefined ? JSON.stringify(relation.temporal) : null,
          relation.metadata !== undefined ? JSON.stringify(relation.metadata) : null
        );
        relationsCount++;
      }

      for (const claim of dataset.claims || []) {
        insertClaimStmt.run(
          claim.id,
          claim.entityId,
          claim.statement,
          claim.confidence,
          claim.source,
          claim.provenance !== undefined ? JSON.stringify(claim.provenance) : null,
          claim.temporal !== undefined ? JSON.stringify(claim.temporal) : null
        );
        claimsCount++;
      }

      for (const doc of dataset.documents || []) {
        insertDocumentStmt.run(
          doc.id,
          doc.entityId,
          doc.content,
          doc.provenance !== undefined ? JSON.stringify(doc.provenance) : null
        );
        documentsCount++;
      }

      return {
        entitiesInserted: entitiesCount,
        aliasesInserted: aliasesCount,
        relationsInserted: relationsCount,
        claimsInserted: claimsCount,
        documentsInserted: documentsCount,
      };
    });

    try {
      const counts = runTx();
      return {
        ...counts,
        timeMs: Date.now() - startTime,
      };
    } catch (e: any) {
      this.handleSqliteError(e);
    }
  }
}
