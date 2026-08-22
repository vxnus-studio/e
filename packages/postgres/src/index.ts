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

export class PostgresEngine implements EQueryEngine, EFixtureMutator, EBatchMutator {
  private pool: Pool;

  constructor(config: PoolConfig) {
    this.pool = new Pool(config);
  }

  async close() {
    await this.pool.end();
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
          const queryText = `
            SELECT DISTINCT e.* FROM e_entities e
            JOIN e_aliases a ON e.id = a.entity_id
            WHERE a.alias = $1 ${request.namespace ? "AND e.namespace = $2" : ""}
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

          queryText += ` ORDER BY id COLLATE "C" ASC`;
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
          const res = await this.pool.query("SELECT * FROM e_claims WHERE entity_id = $1 ORDER BY id COLLATE \"C\" ASC", [request.entityId]);
          result.claims = res.rows.map(this.mapClaim);
          break;
        }
        case "findDocuments": {
          if (!request.entityId || typeof request.entityId !== "string") {
            throw new QueryError("Invalid entityId: must be a non-empty string");
          }
          const res = await this.pool.query("SELECT * FROM e_documents WHERE entity_id = $1 ORDER BY id COLLATE \"C\" ASC", [request.entityId]);
          result.documents = res.rows.map(this.mapDocument);
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
          params.push(effectiveLimit);
          queryText += ` LIMIT $${params.length}`;
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

              // Apply database-level safety limit bounded by remaining expansion budget + safety headroom
              const dbFetchLimit = remainingRelationBudget + 1;
              const queries = [];
              if (allowedDir === "out" || allowedDir === "both") {
                let q = `SELECT * FROM e_relations WHERE subject_id = ANY($1)`;
                const p: any[] = [entityIds];
                if (allowedPreds) {
                  q += ` AND predicate = ANY($2)`;
                  p.push(Array.from(allowedPreds));
                }
                q += ` ORDER BY id ASC LIMIT $${p.length + 1}`;
                p.push(dbFetchLimit);
                queries.push(this.pool.query(q, p).then(r => r.rows.map(row => ({ r: this.mapRelation(row), dir: "out" as const }))));
              }
              if (allowedDir === "in" || allowedDir === "both") {
                let q = `SELECT * FROM e_relations WHERE object_id = ANY($1)`;
                const p: any[] = [entityIds];
                if (allowedPreds) {
                  q += ` AND predicate = ANY($2)`;
                  p.push(Array.from(allowedPreds));
                }
                q += ` ORDER BY id ASC LIMIT $${p.length + 1}`;
                p.push(dbFetchLimit);
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

            for (const current of currentLevelItems) {
              if (pathCount >= pathLimit) {
                truncationOccurred = true;
                break;
              }

              let foundAny = false;
              const relevantEdges = allEdges.filter(e =>
                (e.dir === "out" && e.r.subjectId === current.entityId) ||
                (e.dir === "in" && e.r.objectId === current.entityId)
              );

              for (const { r, dir } of relevantEdges) {
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
              } else if (!foundAny && current.depth > 0) {
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
      if (e instanceof QueryError || e instanceof UnsupportedOperationError || e instanceof ConstraintError) {
        throw e;
      }
      throw new QueryError(e.message, e);
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
    throw new QueryError(e.message, e);
  }

  async insertEntity(entity: Entity): Promise<void> {
    validateEntity(entity);
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
    try {
      await this.pool.query(
        "INSERT INTO e_aliases (id, entity_id, alias) VALUES ($1, $2, $3)",
        [alias.id, alias.entityId, alias.alias]
      );
    } catch (e: any) { this.handlePostgresError(e); }
  }

  async insertRelation(relation: Relation): Promise<void> {
    validateRelation(relation);
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
    const startTime = Date.now();
    const client = await this.pool.connect();
    try {
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
      await client.query("ROLLBACK");
      this.handlePostgresError(e);
    } finally {
      client.release();
    }
  }
}
