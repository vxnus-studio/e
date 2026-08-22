import { test, describe, expect, beforeAll, afterAll } from "vitest";
import { InMemoryEngine } from "@vxnus/e";
import { SqliteEngine } from "@vxnus/e-sqlite";
import { PostgresEngine } from "@vxnus/e-postgres";
import type { Entity, Relation, Alias } from "@vxnus/e";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

function createEntity(id: string, name: string = id, namespace: string = "scale"): Entity {
  return { id, namespace, kind: "item", slug: id.toLowerCase(), name, data: { nested: { count: 1 } } };
}

describe("Scale, Concurrency & High-Volume Stress Tests", () => {
  let memEngine: InMemoryEngine;
  let sqlEngine: SqliteEngine;
  let pgEngine: PostgresEngine | undefined;

  let engines: { name: string; engine: any; insertEntity: (e: Entity) => Promise<void> | void; insertRelation: (r: Relation) => Promise<void> | void }[] = [];

  beforeAll(async () => {
    memEngine = new InMemoryEngine();
    engines.push({
      name: "InMemory",
      engine: memEngine,
      insertEntity: (e) => memEngine.insertEntity(e),
      insertRelation: (r) => memEngine.insertRelation(r)
    });

    sqlEngine = new SqliteEngine(":memory:");
    engines.push({
      name: "SQLite",
      engine: sqlEngine,
      insertEntity: (e) => sqlEngine.insertEntity(e),
      insertRelation: (r) => sqlEngine.insertRelation(r)
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
          insertRelation: (r) => pgEngine!.insertRelation(r)
        });
      } catch (e) {
        if (process.env.CI) throw e;
        console.warn("PostgreSQL not initialized for scale tests: ", e);
      }
    }
  });

  afterAll(async () => {
    sqlEngine.close();
    if (pgEngine) await pgEngine.close();
  });

  test("High volume point lookups and search filtering across 1,000 entities", async () => {
    const count = 1000;
    const batch: Entity[] = [];
    for (let i = 0; i < count; i++) {
      batch.push(createEntity(`vol-ent-${i}`, `Volume Item ${i}`, i % 2 === 0 ? "even" : "odd"));
    }

    for (const e of engines) {
      for (const ent of batch) {
        await e.insertEntity(ent);
      }

      // Point lookup
      const resPoint = await e.engine.query({ type: "getEntity", id: "vol-ent-500" });
      expect(resPoint.entities?.length).toBe(1);
      expect(resPoint.entities![0].name).toBe("Volume Item 500");

      // Search with filter and limit
      const resSearch = await e.engine.query({
        type: "search",
        search: { query: "volume", namespace: "even", limit: 50 }
      });
      expect(resSearch.search?.entities.length).toBe(50);
      expect(resSearch.search?.entities.every((ent: any) => ent.namespace === "even")).toBe(true);
    }
  });

  test("SQLite parameter chunking safety: large batched traversal does not exceed SQLite 999/32766 variable limits", async () => {
    // Generate 600 nodes connected to root
    const root = createEntity("chunk-root", "Root");
    sqlEngine.insertEntity(root);

    for (let i = 0; i < 600; i++) {
      const child = createEntity(`chunk-child-${i}`, `Child ${i}`);
      sqlEngine.insertEntity(child);
      sqlEngine.insertRelation({
        id: `chunk-rel-${i}`,
        subjectId: "chunk-root",
        predicate: "hasChild",
        objectId: `chunk-child-${i}`
      });
    }

    // Traversal across 600 targets in level 1 (chunked in 500 ID batches internally)
    const res = await sqlEngine.query({ type: "traverse", startId: "chunk-root", maxDepth: 1, maxPaths: 1000 });
    expect(res.traversal?.paths.length).toBe(600);
    expect(res.traversal?.entities.length).toBe(601);
  });

  test("Concurrent reader-writer isolation and connection pool stability", async () => {
    if (!pgEngine) return;
    const pool = (pgEngine as any).pool as Pool;

    const concurrentOps = [];

    // Spawn 50 simultaneous concurrent read & write operations
    for (let i = 0; i < 25; i++) {
      concurrentOps.push(pgEngine.query({ type: "getEntity", id: `vol-ent-${i}` }));
      concurrentOps.push(
        pgEngine.insertEntity(createEntity(`conc-ent-${i}`, `Concurrent ${i}`))
      );
    }

    const results = await Promise.allSettled(concurrentOps);
    const failures = results.filter(r => r.status === "rejected");
    expect(failures.length).toBe(0);

    // Verify pool is healthy
    expect(pool.totalCount).toBeLessThanOrEqual(pool.options.max || 10);
  });

  test("Concurrent duplicate insertion race safely rejects duplicates without corruption", async () => {
    if (!pgEngine) return;
    const dupEntity = createEntity("race-dup-ent", "Race Entity");

    // Attempt 10 simultaneous insertions of the exact same primary key
    const raceOps = [];
    for (let i = 0; i < 10; i++) {
      raceOps.push(pgEngine.insertEntity(dupEntity));
    }

    const outcomes = await Promise.allSettled(raceOps);
    const fulfilled = outcomes.filter(o => o.status === "fulfilled");
    const rejected = outcomes.filter(o => o.status === "rejected");

    // Exactly 1 succeeds, 9 fail with ConstraintError
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(9);

    const checkRes = await pgEngine.query({ type: "getEntity", id: "race-dup-ent" });
    expect(checkRes.entities?.length).toBe(1);
  });
});
