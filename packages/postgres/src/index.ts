import { Pool, PoolClient, PoolConfig } from "pg";
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
  DEFAULT_MAX_RESULT_LIMIT,
  MAX_SAFE_RESULT_LIMIT,
  validateEntity,
  validateAlias,
  validateRelation,
  validateClaim,
  validateDocument,
  validateBatchDataset,
  validateQueryRequest,
} from "@vxnus/e";

export class PostgresEngine implements EQueryEngine, EFixtureMutator, EBatchMutator {
  private static readonly CURRENT_MIGRATION_VERSION = 1;
  private static readonly CURRENT_MIGRATION_NAME = "add_provenance_and_identities";
  private pool: Pool;
  private closed = false;
  private closePromise?: Promise<void>;
  private backgroundError?: StorageError;
  private readonly poolErrorHandler: (error: Error) => void;

  constructor(config: PoolConfig) {
    this.pool = new Pool(config);
    this.poolErrorHandler = (error) => {
      this.backgroundError = new StorageError(
        error.message || "PostgreSQL pool background failure",
        error,
        "POOL_BACKGROUND_ERROR",
      );
    };
    // node-postgres emits idle-client and connection errors on the pool. A
    // listener is mandatory: without one EventEmitter treats the event as an
    // uncaught process-level exception.
    this.pool.on("error", this.poolErrorHandler);
  }

  /** Open an engine after applying the authoritative PostgreSQL schema lifecycle. */
  static async open(config: PoolConfig): Promise<PostgresEngine> {
    const engine = new PostgresEngine(config);
    try {
      await engine.migrate();
      return engine;
    } catch (error) {
      await engine.close();
      throw error;
    }
  }

  /**
   * Bootstrap or upgrade E's PostgreSQL schema. The transaction-scoped
   * advisory lock serializes migration attempts across processes and the
   * history row makes replay and compatibility checks explicit.
   */
  async migrate(): Promise<void> {
    this.assertOpen();
    let client: PoolClient | undefined;
    let transactionStarted = false;
    try {
      client = await this.pool.connect();
      await client.query("BEGIN");
      transactionStarted = true;
      await client.query("SELECT pg_advisory_xact_lock(hashtext('e-schema-migrations'))");
      await client.query(`
        CREATE TABLE IF NOT EXISTS e_schema_migrations (
          version INTEGER PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL
        );
        CREATE TABLE IF NOT EXISTS e_entities (
          id VARCHAR(255) PRIMARY KEY, namespace VARCHAR(255) NOT NULL,
          kind VARCHAR(255) NOT NULL, slug VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL, data JSONB NOT NULL DEFAULT '{}'
        );
        CREATE TABLE IF NOT EXISTS e_aliases (
          id VARCHAR(255) PRIMARY KEY, entity_id VARCHAR(255) NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
          alias VARCHAR(255) NOT NULL
        );
        CREATE TABLE IF NOT EXISTS e_relations (
          id VARCHAR(255) PRIMARY KEY, subject_id VARCHAR(255) NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
          predicate VARCHAR(255) NOT NULL, object_id VARCHAR(255) NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS e_claims (
          id VARCHAR(255) PRIMARY KEY, entity_id VARCHAR(255) NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
          statement TEXT NOT NULL, confidence VARCHAR(50) NOT NULL CHECK (confidence IN ('canon', 'theory', 'outdated', 'unverified')),
          source VARCHAR(255) NOT NULL
        );
        CREATE TABLE IF NOT EXISTS e_documents (
          id VARCHAR(255) PRIMARY KEY, entity_id VARCHAR(255) NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
          content TEXT NOT NULL
        );
      `);
      await client.query(`
        ALTER TABLE e_entities ADD COLUMN IF NOT EXISTS identities JSONB;
        ALTER TABLE e_entities ADD COLUMN IF NOT EXISTS provenance JSONB;
        ALTER TABLE e_entities ADD COLUMN IF NOT EXISTS temporal JSONB;
        ALTER TABLE e_relations ADD COLUMN IF NOT EXISTS provenance JSONB;
        ALTER TABLE e_relations ADD COLUMN IF NOT EXISTS temporal JSONB;
        ALTER TABLE e_relations ADD COLUMN IF NOT EXISTS metadata JSONB;
        ALTER TABLE e_claims ADD COLUMN IF NOT EXISTS provenance JSONB;
        ALTER TABLE e_claims ADD COLUMN IF NOT EXISTS temporal JSONB;
        ALTER TABLE e_documents ADD COLUMN IF NOT EXISTS provenance JSONB;
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
      const history = await client.query<{ version: number; name: string }>(
        "SELECT version, name FROM e_schema_migrations ORDER BY version ASC",
      );
      const unsupported = history.rows.find((row) => row.version > PostgresEngine.CURRENT_MIGRATION_VERSION);
      if (unsupported) {
        throw new StorageError(
          `PostgreSQL schema version ${unsupported.version} is newer than supported version ${PostgresEngine.CURRENT_MIGRATION_VERSION}`,
          undefined,
          "SCHEMA_VERSION_UNSUPPORTED",
        );
      }
      const current = history.rows.find((row) => row.version === PostgresEngine.CURRENT_MIGRATION_VERSION);
      if (current && current.name !== PostgresEngine.CURRENT_MIGRATION_NAME) {
        throw new StorageError("PostgreSQL migration history does not match the bundled migration", undefined, "SCHEMA_MIGRATION_MISMATCH");
      }
      if (!current) {
        await client.query(
          "INSERT INTO e_schema_migrations (version, name, applied_at) VALUES ($1, $2, NOW())",
          [PostgresEngine.CURRENT_MIGRATION_VERSION, PostgresEngine.CURRENT_MIGRATION_NAME],
        );
      }
      await client.query("COMMIT");
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted && client) {
        try { await client.query("ROLLBACK"); } catch (rollbackError) {
          throw new StorageError("PostgreSQL migration rollback failed", rollbackError, "TRANSACTION_ROLLBACK_FAILED");
        }
      }
      if (error instanceof StorageError) throw error;
      throw new StorageError(error instanceof Error ? error.message : "PostgreSQL migration failed", error, "SCHEMA_MIGRATION_FAILED");
    } finally {
      client?.release();
    }
  }

  async close() {
    if (!this.closePromise) {
      this.closed = true;
      this.closePromise = this.pool.end();
    }
    await this.closePromise;
    this.pool.removeListener("error", this.poolErrorHandler);
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new StorageError("PostgreSQL engine is closed", undefined, "ENGINE_CLOSED");
    }
    if (this.backgroundError) {
      throw this.backgroundError;
    }
  }

  async query(request: QueryRequest): Promise<KnowledgeResult> {
    validateQueryRequest(request);
    this.assertOpen();
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
          const queryText = `
            SELECT e.* FROM e_entities e
            WHERE EXISTS (
              SELECT 1 FROM e_aliases a
              WHERE a.entity_id = e.id AND a.alias = $1
            ) ${request.namespace ? "AND e.namespace = $2" : ""}
            ORDER BY e.id COLLATE "C" ASC
          `;
          const params = request.namespace ? [request.alias, request.namespace] : [request.alias];
          const res = await this.pool.query(queryText, params);
          result.entities = res.rows.map((row) => this.mapEntity(row));
          break;
        }
        case "getEntity": {
          if (!request.id || typeof request.id !== "string") {
            throw new QueryError("Invalid id: must be a non-empty string");
          }
          const res = await this.pool.query("SELECT * FROM e_entities WHERE id = $1", [request.id]);
          if (res.rows.length > 0) {
            result.entities = [this.mapEntity(res.rows[0])];
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

          const limit = Math.min(request.limit ?? DEFAULT_MAX_RESULT_LIMIT, MAX_SAFE_RESULT_LIMIT);
          params.push(limit + 1);
          queryText += ` ORDER BY id COLLATE "C" ASC LIMIT $${params.length}`;
          const res = await this.pool.query(queryText, params);
          if (res.rows.length > limit) { result.metadata.partial = true; result.metadata.warnings = [`Result limit reached: ${limit}`]; }
          result.relations = res.rows.slice(0, limit).map(this.mapRelation);

          if (result.relations.length > 0) {
            const entityIds = new Set<string>();
            for (const r of result.relations) {
              entityIds.add(r.subjectId);
              entityIds.add(r.objectId);
            }
            if (entityIds.size > 0) {
              const entitiesRes = await this.pool.query(
                `SELECT * FROM e_entities WHERE id = ANY($1::varchar[]) ORDER BY id COLLATE "C" ASC`,
                [Array.from(entityIds)]
              );
              result.entities = entitiesRes.rows.map(this.mapEntity);
            }
          }
          break;
        }
        case "findClaims": {
          if (!request.entityId || typeof request.entityId !== "string") {
            throw new QueryError("Invalid entityId: must be a non-empty string");
          }
          const limit = Math.min(request.limit ?? DEFAULT_MAX_RESULT_LIMIT, MAX_SAFE_RESULT_LIMIT);
          const res = await this.pool.query("SELECT * FROM e_claims WHERE entity_id = $1 ORDER BY id COLLATE \"C\" ASC LIMIT $2", [request.entityId, limit + 1]);
          if (res.rows.length > limit) { result.metadata.partial = true; result.metadata.warnings = [`Result limit reached: ${limit}`]; }
          result.claims = res.rows.slice(0, limit).map(this.mapClaim);
          break;
        }
        case "findDocuments": {
          if (!request.entityId || typeof request.entityId !== "string") {
            throw new QueryError("Invalid entityId: must be a non-empty string");
          }
          const limit = Math.min(request.limit ?? DEFAULT_MAX_RESULT_LIMIT, MAX_SAFE_RESULT_LIMIT);
          const res = await this.pool.query("SELECT * FROM e_documents WHERE entity_id = $1 ORDER BY id COLLATE \"C\" ASC LIMIT $2", [request.entityId, limit + 1]);
          if (res.rows.length > limit) { result.metadata.partial = true; result.metadata.warnings = [`Result limit reached: ${limit}`]; }
          result.documents = res.rows.slice(0, limit).map(this.mapDocument);
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
          params.push(effectiveLimit + 1);
          queryText += ` LIMIT $${params.length}`;
          const res = await this.pool.query(queryText, params);
          if (res.rows.length > effectiveLimit) { result.metadata.partial = true; result.metadata.warnings = [`Search result limit reached: ${effectiveLimit}`]; }
          const entities = res.rows.slice(0, effectiveLimit).map((row) => this.mapEntity(row));
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

          if (maxEntitiesHydrated === 0) {
            result.traversal = { entities: [], relations: [], paths: [] };
            result.entities = [];
            result.relations = [];
            result.metadata.partial = true;
            result.metadata.warnings = ["Traversal truncated: maxEntitiesHydrated limit reached"];
            break;
          }

          const startRes = await this.pool.query("SELECT * FROM e_entities WHERE id = $1", [request.startId]);
          if (startRes.rows.length === 0) {
            result.traversal = { entities: [], relations: [], paths: [] };
            break;
          }
          const startEntity = this.mapEntity(startRes.rows[0]);

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
            let allEdges: { r: Relation, dir: "out" | "in" }[] = [];

            if (entityIds.length > 0) {
              const remainingRelationBudget = Math.max(0, maxRelationsExpanded - totalRelationsExpanded);
              if (remainingRelationBudget <= 0) {
                truncationOccurred = true;
                if (!truncationReasons.includes("maxRelationsExpanded limit reached")) {
                  truncationReasons.push("maxRelationsExpanded limit reached");
                }
                break;
              }

              // Allocate the fetch budget across frontier entities so one high-degree
              // entity cannot starve the rest of the frontier. The allocation is
              // applied inside one set-based query; do not turn a wide frontier into
              // one round trip per entity.
              const baseBudget = Math.floor(remainingRelationBudget / entityIds.length);
              let extraBudget = remainingRelationBudget % entityIds.length;
              const frontierBudgets = entityIds.map(() => baseBudget + (extraBudget-- > 0 ? 1 : 0));
              const params: any[] = [entityIds, frontierBudgets];
              const predicateParam = allowedPreds ? 3 : undefined;
              const candidates: string[] = [];
              if (allowedDir === "out" || allowedDir === "both") {
                let q = `SELECT f.entity_id AS frontier_id, 'out'::text AS dir, r.*
                  FROM frontier f JOIN e_relations r ON r.subject_id = f.entity_id
                  WHERE f.budget > 0`;
                if (allowedPreds) { q += ` AND r.predicate = ANY($${predicateParam})`; }
                candidates.push(q);
              }
              if (allowedDir === "in" || allowedDir === "both") {
                let q = `SELECT f.entity_id AS frontier_id, 'in'::text AS dir, r.*
                  FROM frontier f JOIN e_relations r ON r.object_id = f.entity_id
                  WHERE f.budget > 0`;
                if (allowedPreds) { q += ` AND r.predicate = ANY($${predicateParam})`; }
                candidates.push(q);
              }
              if (allowedPreds) params.push(Array.from(allowedPreds));
              const queryText = `
                WITH frontier(entity_id, budget) AS (
                  SELECT * FROM unnest($1::varchar[], $2::integer[])
                ), candidates AS (
                  ${candidates.join(" UNION ALL ")}
                ), ranked AS (
                  SELECT candidates.*, frontier.budget,
                    row_number() OVER (PARTITION BY frontier_id ORDER BY id ASC, dir ASC) AS frontier_rank,
                    count(*) OVER (PARTITION BY frontier_id) AS available_count
                  FROM candidates
                  JOIN frontier ON frontier.entity_id = candidates.frontier_id
                )
                SELECT * FROM ranked
                WHERE frontier_rank <= budget
                ORDER BY id ASC, dir ASC, frontier_id ASC
              `;
              const res = await this.pool.query(queryText, params);
              for (const row of res.rows) {
                if (row.available_count > row.budget) {
                  truncationOccurred = true;
                  if (!truncationReasons.includes("maxRelationsExpanded limit reached")) {
                    truncationReasons.push("maxRelationsExpanded limit reached");
                  }
                }
                allEdges.push({ r: this.mapRelation(row), dir: row.dir as "out" | "in" });
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
            }

            if (nextEntityIds.size > 0) {
              const remainingEntityBudget = Math.max(0, maxEntitiesHydrated - visitedEntities.size);
              if (remainingEntityBudget <= 0) {
                truncationOccurred = true;
                if (!truncationReasons.includes("maxEntitiesHydrated limit reached")) {
                  truncationReasons.push("maxEntitiesHydrated limit reached");
                }
              } else {
                const idsToHydrate = Array.from(nextEntityIds).slice(0, remainingEntityBudget);
                if (idsToHydrate.length < nextEntityIds.size) {
                  truncationOccurred = true;
                  if (!truncationReasons.includes("maxEntitiesHydrated limit reached")) {
                    truncationReasons.push("maxEntitiesHydrated limit reached");
                  }
                }
                if (idsToHydrate.length > 0) {
                  const nextEntsRes = await this.pool.query("SELECT * FROM e_entities WHERE id = ANY($1)", [idsToHydrate]);
                  for (const row of nextEntsRes.rows) {
                    const ent = this.mapEntity(row);
                    visitedEntities.set(ent.id, ent);
                  }
                }
              }
            }

            let nextFrontier: FrontierItem[] = [];

            const edgeQueues = currentLevelItems.map(current => ({
              current,
              edges: allEdges.filter(e =>
                (e.dir === "out" && e.r.subjectId === current.entityId) ||
                (e.dir === "in" && e.r.objectId === current.entityId)
              ),
            }));
            const foundAny = edgeQueues.map(() => false);
            let madeProgress = true;
            while (madeProgress && pathCount < pathLimit) {
              madeProgress = false;
              for (let i = 0; i < edgeQueues.length; i++) {
                const queue = edgeQueues[i]!;
                const next = queue.edges.shift();
                if (!next) continue;
                madeProgress = true;
                const current = queue.current;
                const { r, dir } = next;
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

                const nextId = dir === "out" ? r.objectId : r.subjectId;
                if (!visitedEntities.has(nextId)) continue;

                if (!visitedRelations.has(r.id)) {
                  visitedRelations.set(r.id, r);
                }

                const newEdge: TraversalPathEdge = {
                  relationId: r.id,
                  sourceId: dir === "out" ? current.entityId : nextId,
                  targetId: dir === "out" ? nextId : current.entityId,
                  predicate: r.predicate,
                  direction: dir
                };

                // Intermediate frontier bounding: prevent runaway allocation
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
                foundAny[i] = true;
              }
            }

            for (let i = 0; i < currentLevelItems.length; i++) {
              const current = currentLevelItems[i]!;
              if (!foundAny[i] && current.depth > 0 && pathCount < pathLimit) {
                paths.push({
                  startId: request.startId,
                  endId: current.entityId,
                  edges: current.pathEdges,
                  depth: current.depth
                });
                pathCount++;
              } else if (!foundAny[i] && current.depth > 0) {
                truncationOccurred = true;
                if (!truncationReasons.includes("maxPaths limit reached")) {
                  truncationReasons.push("maxPaths limit reached");
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

          if (truncationOccurred) {
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
      throw new StorageError(e instanceof Error ? e.message : "PostgreSQL storage failure", e);
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

  // --- EFixtureMutator Implementation ---
  private handlePostgresError(e: any): never {
    if (e.code === "23505" || e.code === "23503" || e.code === "23514" || e.code === "23502") {
      throw new ConstraintError(e.message, e, e.code);
    }
    throw new StorageError(e instanceof Error ? e.message : "PostgreSQL storage failure", e);
  }

  async insertEntity(entity: Entity): Promise<void> {
    validateEntity(entity);
    this.assertOpen();
    try {
      await this.pool.query(
        `INSERT INTO e_entities (id, namespace, kind, slug, name, data, identities, provenance, temporal)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          entity.id,
          entity.namespace,
          entity.kind,
          entity.slug,
          entity.name,
          JSON.stringify(entity.data || {}),
          entity.identities !== undefined ? JSON.stringify(entity.identities) : null,
          entity.provenance !== undefined ? JSON.stringify(entity.provenance) : null,
          entity.temporal !== undefined ? JSON.stringify(entity.temporal) : null
        ]
      );
    } catch (e: any) { this.handlePostgresError(e); }
  }

  async insertAlias(alias: Alias): Promise<void> {
    validateAlias(alias);
    this.assertOpen();
    try {
      await this.pool.query(
        "INSERT INTO e_aliases (id, entity_id, alias) VALUES ($1, $2, $3)",
        [alias.id, alias.entityId, alias.alias]
      );
    } catch (e: any) { this.handlePostgresError(e); }
  }

  async insertRelation(relation: Relation): Promise<void> {
    validateRelation(relation);
    this.assertOpen();
    try {
      await this.pool.query(
        `INSERT INTO e_relations (id, subject_id, predicate, object_id, provenance, temporal, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          relation.id,
          relation.subjectId,
          relation.predicate,
          relation.objectId,
          relation.provenance !== undefined ? JSON.stringify(relation.provenance) : null,
          relation.temporal !== undefined ? JSON.stringify(relation.temporal) : null,
          relation.metadata !== undefined ? JSON.stringify(relation.metadata) : null
        ]
      );
    } catch (e: any) { this.handlePostgresError(e); }
  }

  async insertClaim(claim: Claim): Promise<void> {
    validateClaim(claim);
    this.assertOpen();
    try {
      await this.pool.query(
        `INSERT INTO e_claims (id, entity_id, statement, confidence, source, provenance, temporal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          claim.id,
          claim.entityId,
          claim.statement,
          claim.confidence,
          claim.source,
          claim.provenance !== undefined ? JSON.stringify(claim.provenance) : null,
          claim.temporal !== undefined ? JSON.stringify(claim.temporal) : null
        ]
      );
    } catch (e: any) { this.handlePostgresError(e); }
  }

  async insertDocument(doc: Document): Promise<void> {
    validateDocument(doc);
    this.assertOpen();
    try {
      await this.pool.query(
        `INSERT INTO e_documents (id, entity_id, content, provenance)
         VALUES ($1, $2, $3, $4)`,
        [
          doc.id,
          doc.entityId,
          doc.content,
          doc.provenance !== undefined ? JSON.stringify(doc.provenance) : null
        ]
      );
    } catch (e: any) { this.handlePostgresError(e); }
  }

  // --- EBatchMutator Implementation (Atomic Transactions) ---
  async ingestBatch(dataset: BatchDataset): Promise<BatchIngestResult> {
    validateBatchDataset(dataset);
    this.assertOpen();
    const startTime = Date.now();
    let client: PoolClient | undefined;
    try {
      client = await this.pool.connect();
      await client.query("BEGIN");

      let entitiesCount = 0;
      let aliasesCount = 0;
      let relationsCount = 0;
      let claimsCount = 0;
      let documentsCount = 0;

      for (const entity of dataset.entities || []) {
        await client.query(
          `INSERT INTO e_entities (id, namespace, kind, slug, name, data, identities, provenance, temporal)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            entity.id,
            entity.namespace,
            entity.kind,
            entity.slug,
            entity.name,
            JSON.stringify(entity.data || {}),
            entity.identities !== undefined ? JSON.stringify(entity.identities) : null,
            entity.provenance !== undefined ? JSON.stringify(entity.provenance) : null,
            entity.temporal !== undefined ? JSON.stringify(entity.temporal) : null
          ]
        );
        entitiesCount++;
      }

      for (const alias of dataset.aliases || []) {
        await client.query(
          "INSERT INTO e_aliases (id, entity_id, alias) VALUES ($1, $2, $3)",
          [alias.id, alias.entityId, alias.alias]
        );
        aliasesCount++;
      }

      for (const relation of dataset.relations || []) {
        await client.query(
          `INSERT INTO e_relations (id, subject_id, predicate, object_id, provenance, temporal, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            relation.id,
            relation.subjectId,
            relation.predicate,
            relation.objectId,
            relation.provenance !== undefined ? JSON.stringify(relation.provenance) : null,
            relation.temporal !== undefined ? JSON.stringify(relation.temporal) : null,
            relation.metadata !== undefined ? JSON.stringify(relation.metadata) : null
          ]
        );
        relationsCount++;
      }

      for (const claim of dataset.claims || []) {
        await client.query(
          `INSERT INTO e_claims (id, entity_id, statement, confidence, source, provenance, temporal)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            claim.id,
            claim.entityId,
            claim.statement,
            claim.confidence,
            claim.source,
            claim.provenance !== undefined ? JSON.stringify(claim.provenance) : null,
            claim.temporal !== undefined ? JSON.stringify(claim.temporal) : null
          ]
        );
        claimsCount++;
      }

      for (const doc of dataset.documents || []) {
        await client.query(
          `INSERT INTO e_documents (id, entity_id, content, provenance)
           VALUES ($1, $2, $3, $4)`,
          [
            doc.id,
            doc.entityId,
            doc.content,
            doc.provenance !== undefined ? JSON.stringify(doc.provenance) : null
          ]
        );
        documentsCount++;
      }

      await client.query("COMMIT");

      return {
        entitiesInserted: entitiesCount,
        aliasesInserted: aliasesCount,
        relationsInserted: relationsCount,
        claimsInserted: claimsCount,
        documentsInserted: documentsCount,
        timeMs: Date.now() - startTime,
      };
    } catch (e: any) {
      try {
        if (client) await client.query("ROLLBACK");
      } catch (rollbackError) {
        throw new StorageError(
          "PostgreSQL transaction rollback failed",
          { error: e, rollbackError },
          "TRANSACTION_ROLLBACK_FAILED",
        );
      }
      return this.handlePostgresError(e);
    } finally {
      client?.release();
    }
  }
}
