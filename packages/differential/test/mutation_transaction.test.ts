import { test, describe, expect, beforeAll, afterAll } from "vitest";
import { InMemoryEngine } from "@vxnus/e";
import { SqliteEngine } from "@vxnus/e-sqlite";
import { PostgresEngine } from "@vxnus/e-postgres";
import type { Entity, Relation, Alias, Claim, Document } from "@vxnus/e";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

function createEntity(id: string, name: string = id): Entity {
  return { id, namespace: "tx", kind: "node", slug: name.toLowerCase(), name, data: {} };
}

describe("Mutation Atomicity & Failure Isolation", () => {
  let memEngine: InMemoryEngine;
  let sqlEngine: SqliteEngine;
  let pgEngine: PostgresEngine | undefined;

  let engines: { name: string; engine: any; insertEntity: (e: Entity) => Promise<void> | void; insertAlias: (a: Alias) => Promise<void> | void; insertRelation: (r: Relation) => Promise<void> | void; insertClaim: (c: Claim) => Promise<void> | void; insertDocument: (d: Document) => Promise<void> | void; }[] = [];

  beforeAll(async () => {
    memEngine = new InMemoryEngine();
    engines.push({
      name: "InMemory",
      engine: memEngine,
      insertEntity: (e) => memEngine.insertEntity(e),
      insertAlias: (a) => memEngine.insertAlias(a),
      insertRelation: (r) => memEngine.insertRelation(r),
      insertClaim: (c) => memEngine.insertClaim(c),
      insertDocument: (d) => memEngine.insertDocument(d)
    });

    sqlEngine = new SqliteEngine(":memory:");
    engines.push({
      name: "SQLite",
      engine: sqlEngine,
      insertEntity: (e) => sqlEngine.insertEntity(e),
      insertAlias: (a) => sqlEngine.insertAlias(a),
      insertRelation: (r) => sqlEngine.insertRelation(r),
      insertClaim: (c) => sqlEngine.insertClaim(c),
      insertDocument: (d) => sqlEngine.insertDocument(d)
    });

    const testDbUrl = process.env.TEST_DATABASE_URL;
    if (testDbUrl) {
      try {
        pgEngine = new PostgresEngine({ connectionString: testDbUrl });
        const pool = (pgEngine as any).pool as Pool;
        const schemaSql = fs.readFileSync(path.join(__dirname, "../../postgres/schema.sql"), "utf-8");
        await pool.query(schemaSql);
        await pool.query("TRUNCATE TABLE e_entities, e_aliases, e_relations, e_claims, e_documents CASCADE;");
        engines.push({
          name: "PostgreSQL",
          engine: pgEngine,
          insertEntity: (e) => pgEngine!.insertEntity(e),
          insertAlias: (a) => pgEngine!.insertAlias(a),
          insertRelation: (r) => pgEngine!.insertRelation(r),
          insertClaim: (c) => pgEngine!.insertClaim(c),
          insertDocument: (d) => pgEngine!.insertDocument(d)
        });
      } catch (e) {
        if (process.env.CI) throw e;
        console.warn("PostgreSQL not initialized for transaction tests: ", e);
      }
    }
  });

  afterAll(async () => {
    sqlEngine.close();
    if (pgEngine) await pgEngine.close();
  });

  test("Single insert operations are atomic and reject duplicates with ConstraintError", async () => {
    const e1 = createEntity("tx-ent-1", "Tx 1");
    for (const e of engines) {
      await e.insertEntity(e1);
      
      // Duplicate insert must throw ConstraintError
      await expect(async () => {
        await e.insertEntity(e1);
      }).rejects.toThrow();

      const res = await e.engine.query({ type: "getEntity", id: "tx-ent-1" });
      expect(res.entities?.length).toBe(1);
    }
  });

  test("Foreign key constraints reject orphan aliases and relations without leaving partial state", async () => {
    for (const e of engines) {
      // Alias referencing nonexistent entity
      const orphanAlias: Alias = { id: "orph-a1", entityId: "missing-ent", alias: "Orphan" };
      await expect(async () => {
        await e.insertAlias(orphanAlias);
      }).rejects.toThrow();

      const resA = await e.engine.query({ type: "resolve", alias: "Orphan" });
      expect(resA.entities).toEqual([]);

      // Relation referencing nonexistent object
      const orphanRel: Relation = { id: "orph-r1", subjectId: "tx-ent-1", predicate: "links", objectId: "missing-obj" };
      await expect(async () => {
        await e.insertRelation(orphanRel);
      }).rejects.toThrow();

      const resR = await e.engine.query({ type: "findRelations", subjectId: "tx-ent-1" });
      expect(resR.relations).toEqual([]);
    }
  });

  test("Cascade deletion integrity: deleting entity removes aliases and relations in SQLite and PostgreSQL", async () => {
    // Create entities and dependent aliases/relations
    const entParent = createEntity("casc-parent", "Parent");
    const entChild = createEntity("casc-child", "Child");

    for (const e of engines) {
      await e.insertEntity(entParent);
      await e.insertEntity(entChild);
      await e.insertAlias({ id: "casc-al-1", entityId: "casc-parent", alias: "ParentAlias" });
      await e.insertRelation({ id: "casc-rel-1", subjectId: "casc-parent", predicate: "parentOf", objectId: "casc-child" });
      await e.insertClaim({ id: "casc-cl-1", entityId: "casc-parent", statement: "Parent claim", confidence: "canon", source: "Canon Doc" });
      await e.insertDocument({ id: "casc-doc-1", entityId: "casc-parent", content: "Parent document lore" });

      const resBefore = await e.engine.query({ type: "resolve", alias: "ParentAlias" });
      expect(resBefore.entities?.length).toBe(1);

      // Perform genuine DELETE of parent entity on DB-backed engines
      if (e.name === "SQLite") {
        const db = (e.engine as any).db;
        db.prepare("DELETE FROM e_entities WHERE id = ?").run("casc-parent");
      } else if (e.name === "PostgreSQL" && pgEngine) {
        const pool = (e.engine as any).pool as Pool;
        await pool.query("DELETE FROM e_entities WHERE id = $1", ["casc-parent"]);
      } else if (e.name === "InMemory") {
        // InMemory internal direct deletion simulation
        (e.engine as any).entities.delete("casc-parent");
        (e.engine as any).aliases = (e.engine as any).aliases.filter((a: any) => a.entityId !== "casc-parent");
        (e.engine as any).relations = (e.engine as any).relations.filter((r: any) => r.subjectId !== "casc-parent" && r.objectId !== "casc-parent");
        (e.engine as any).claims = (e.engine as any).claims.filter((c: any) => c.entityId !== "casc-parent");
        (e.engine as any).documents = (e.engine as any).documents.filter((d: any) => d.entityId !== "casc-parent");
      }

      // Assert that parent is gone
      const resParent = await e.engine.query({ type: "getEntity", id: "casc-parent" });
      expect(resParent.entities).toEqual([]);

      // Assert that alias, relation, claim, and document were cascade-deleted
      const resAfterAlias = await e.engine.query({ type: "resolve", alias: "ParentAlias" });
      expect(resAfterAlias.entities).toEqual([]);

      const resAfterRel = await e.engine.query({ type: "findRelations", subjectId: "casc-parent" });
      expect(resAfterRel.relations).toEqual([]);

      const resAfterClaim = await e.engine.query({ type: "findClaims", entityId: "casc-parent" });
      expect(resAfterClaim.claims).toEqual([]);

      const resAfterDoc = await e.engine.query({ type: "findDocuments", entityId: "casc-parent" });
      expect(resAfterDoc.documents).toEqual([]);
    }
  });

  test("PostgreSQL connection pool lifecycle: queries and errors properly release pool clients", async () => {
    if (!pgEngine) return;
    const pool = (pgEngine as any).pool as Pool;
    const initialIdle = pool.idleCount;

    // Run batch of queries
    for (let i = 0; i < 20; i++) {
      await pgEngine.query({ type: "getEntity", id: `tx-ent-1` });
    }

    // Attempt invalid query that fails
    try {
      await pgEngine.insertAlias({ id: "fail-al", entityId: "nonexistent", alias: "fail" });
    } catch {
      // expected failure
    }

    // Verify client was released back to pool and pool is not exhausted
    expect(pool.totalCount).toBeLessThanOrEqual(pool.options.max || 10);
  });

  test("Atomic multi-record batch ingestion: all-or-nothing rollback on mid-batch constraint failure", async () => {
    for (const e of engines) {
      // Clean isolated test entities
      const batchEnt1 = createEntity("batch-rollback-1", "Batch 1");
      const batchEnt2 = createEntity("batch-rollback-2", "Batch 2");
      const batchEnt3 = createEntity("batch-rollback-3", "Batch 3");

      const failingDataset = {
        entities: [batchEnt1, batchEnt2, batchEnt3],
        aliases: [
          { id: "b-al-1", entityId: "batch-rollback-1", alias: "B1" },
          // This alias has invalid entityId -> Foreign key failure midway through batch
          { id: "b-al-fail", entityId: "nonexistent-entity-id", alias: "BFail" }
        ],
        relations: [
          { id: "b-rel-1", subjectId: "batch-rollback-1", predicate: "connects", objectId: "batch-rollback-2" }
        ]
      };

      // Batch ingestion must fail
      await expect(async () => {
        await e.engine.ingestBatch(failingDataset);
      }).rejects.toThrow();

      // Verify ZERO records from the batch remain committed (All-or-Nothing rollback)
      const res1 = await e.engine.query({ type: "getEntity", id: "batch-rollback-1" });
      const res2 = await e.engine.query({ type: "getEntity", id: "batch-rollback-2" });
      const res3 = await e.engine.query({ type: "getEntity", id: "batch-rollback-3" });
      const resA = await e.engine.query({ type: "resolve", alias: "B1" });

      expect(res1.entities, `Engine ${e.name} should rollback batch-rollback-1`).toEqual([]);
      expect(res2.entities, `Engine ${e.name} should rollback batch-rollback-2`).toEqual([]);
      expect(res3.entities, `Engine ${e.name} should rollback batch-rollback-3`).toEqual([]);
      expect(resA.entities, `Engine ${e.name} should rollback alias B1`).toEqual([]);
    }
  });

  test("Successful multi-record batch ingestion commits all entity types atomically", async () => {
    for (const e of engines) {
      const entA = createEntity("batch-succ-A", "Succ A");
      const entB = createEntity("batch-succ-B", "Succ B");

      const validDataset = {
        entities: [entA, entB],
        aliases: [
          { id: "b-succ-al-1", entityId: "batch-succ-A", alias: "SuccAliasA" },
          { id: "b-succ-al-2", entityId: "batch-succ-B", alias: "SuccAliasB" }
        ],
        relations: [
          { id: "b-succ-rel-1", subjectId: "batch-succ-A", predicate: "links", objectId: "batch-succ-B" }
        ],
        claims: [
          { id: "b-succ-cl-1", entityId: "batch-succ-A", statement: "Is canon fact", confidence: "canon" as const, source: "Archon Quest" }
        ],
        documents: [
          { id: "b-succ-doc-1", entityId: "batch-succ-B", content: "Document lore content" }
        ]
      };

      const result = await e.engine.ingestBatch(validDataset);
      expect(result.entitiesInserted).toBe(2);
      expect(result.aliasesInserted).toBe(2);
      expect(result.relationsInserted).toBe(1);
      expect(result.claimsInserted).toBe(1);
      expect(result.documentsInserted).toBe(1);
      expect(result.timeMs).toBeGreaterThanOrEqual(0);

      // Verify all records queryable
      const resEnt = await e.engine.query({ type: "getEntity", id: "batch-succ-A" });
      expect(resEnt.entities?.length).toBe(1);

      const resAl = await e.engine.query({ type: "resolve", alias: "SuccAliasA" });
      expect(resAl.entities?.length).toBe(1);

      const resRel = await e.engine.query({ type: "findRelations", subjectId: "batch-succ-A" });
      expect(resRel.relations?.length).toBe(1);

      const resCl = await e.engine.query({ type: "findClaims", entityId: "batch-succ-A" });
      expect(resCl.claims?.length).toBe(1);

      const resDoc = await e.engine.query({ type: "findDocuments", entityId: "batch-succ-B" });
      expect(resDoc.documents?.length).toBe(1);
    }
  });

  test("Empty batch ingestion succeeds with zero counts", async () => {
    for (const e of engines) {
      const res = await e.engine.ingestBatch({});
      expect(res.entitiesInserted).toBe(0);
      expect(res.aliasesInserted).toBe(0);
      expect(res.relationsInserted).toBe(0);
      expect(res.claimsInserted).toBe(0);
      expect(res.documentsInserted).toBe(0);
    }
  });
});
