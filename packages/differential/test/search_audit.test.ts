import { test, describe, expect, beforeAll, afterAll } from "vitest";
import { InMemoryEngine } from "@vxnus/e";
import { SqliteEngine } from "@vxnus/e-sqlite";
import { PostgresEngine } from "@vxnus/e-postgres";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

describe("Search Audit & Differential Verification", () => {
  let pgPool: Pool | undefined;
  let memEngine: InMemoryEngine;
  let sqlEngine: SqliteEngine;
  let pgEngine: PostgresEngine | undefined;

  let activeEngines: { name: string; query: (req: any) => Promise<any> }[] = [];

  beforeAll(async () => {
    memEngine = new InMemoryEngine();
    activeEngines.push({ name: "InMemory", query: (r) => memEngine.query(r) });

    sqlEngine = new SqliteEngine(":memory:");
    activeEngines.push({ name: "SQLite", query: (r) => sqlEngine.query(r) });

    const testDbUrl = process.env.TEST_DATABASE_URL;
    if (testDbUrl) {
      try {
        pgEngine = new PostgresEngine({ connectionString: testDbUrl });
        pgPool = (pgEngine as any).pool as Pool;
        const schemaSql = fs.readFileSync(path.join(__dirname, "../../postgres/schema.sql"), "utf-8");
        await pgPool.query(schemaSql);
        await pgPool.query("TRUNCATE TABLE e_entities, e_aliases, e_relations, e_claims, e_documents CASCADE;");
        activeEngines.push({ name: "PostgreSQL", query: (r) => pgEngine!.query(r) });
      } catch (e) {
        console.warn("PostgreSQL not initialized for search audit: ", e);
      }
    }

    const testEntities = [
      { id: "1", namespace: "ns", kind: "test", name: "Alpha", slug: "alpha", data: {} },
      { id: "2", namespace: "ns", kind: "test", name: "Beta", slug: "beta", data: {} },
      { id: "3", namespace: "ns", kind: "test", name: "Gamma", slug: "gamma", data: {} },
      { id: "4", namespace: "ns", kind: "test", name: "hello%world", slug: "hello-world", data: {} },
      { id: "5", namespace: "ns", kind: "test", name: "hello_world", slug: "hello-world-2", data: {} },
      { id: "6", namespace: "ns", kind: "test", name: "café", slug: "cafe", data: {} },
      { id: "7", namespace: "ns", kind: "test", name: "CAFE", slug: "cafe2", data: {} },
    ];

    for (const ent of testEntities) {
      memEngine.insertEntity(ent);
      sqlEngine.insertEntity(ent);
      if (pgEngine) await pgEngine.insertEntity(ent);
    }
  });

  afterAll(async () => {
    sqlEngine.close();
    if (pgEngine) await pgEngine.close();
  });

  test("Empty query returns all entities up to default/safe limit across all backends", async () => {
    for (const e of activeEngines) {
      const res = await e.query({ type: "search", search: { query: "" } });
      const ids = res.search?.entities.map((ent: any) => ent.id).sort();
      expect(ids, `Engine ${e.name} should return all 7 entities for empty query`).toEqual([
        "1", "2", "3", "4", "5", "6", "7"
      ]);
    }
  });

  test("Whitespace query matches only literal whitespace substring across all backends", async () => {
    for (const e of activeEngines) {
      const res = await e.query({ type: "search", search: { query: "   " } });
      expect(res.search?.entities.length, `Engine ${e.name} should find 0 matches for non-existent spaces`).toBe(0);
    }
  });

  test("Wildcard character '%' is escaped and treated as literal character across all backends", async () => {
    for (const e of activeEngines) {
      const res = await e.query({ type: "search", search: { query: "%" } });
      const ids = res.search?.entities.map((ent: any) => ent.id);
      // Contract: Must only match entity '4' (hello%world), NOT every entity
      expect(ids, `Engine ${e.name} failed literal % matching`).toEqual(["4"]);
    }
  });

  test("Wildcard character '_' is escaped and treated as literal character across all backends", async () => {
    for (const e of activeEngines) {
      const res = await e.query({ type: "search", search: { query: "_" } });
      const ids = res.search?.entities.map((ent: any) => ent.id);
      // Contract: Must only match entity '5' (hello_world), NOT every 1-char wildcard
      expect(ids, `Engine ${e.name} failed literal _ matching`).toEqual(["5"]);
    }
  });

  test("ASCII case-insensitive matching parity", async () => {
    for (const e of activeEngines) {
      const resAlphaLower = await e.query({ type: "search", search: { query: "alpha" } });
      const resAlphaUpper = await e.query({ type: "search", search: { query: "ALPHA" } });
      expect(resAlphaLower.search?.entities.map((ent: any) => ent.id)).toEqual(["1"]);
      expect(resAlphaUpper.search?.entities.map((ent: any) => ent.id)).toEqual(["1"]);
    }
  });

  test("Limit constraints and boundary assertions", async () => {
    for (const e of activeEngines) {
      // limit: 0 returns 0 results
      const res0 = await e.query({ type: "search", search: { query: "a", limit: 0 } });
      expect(res0.search?.entities.length).toBe(0);

      // limit: 1 returns exactly 1 result
      const res1 = await e.query({ type: "search", search: { query: "a", limit: 1 } });
      expect(res1.search?.entities.length).toBe(1);

      // limit: 100 returns all matches without exceeding total matches
      const res100 = await e.query({ type: "search", search: { query: "a", limit: 100 } });
      expect(res100.search?.entities.length).toBe(5);

      // negative limit throws QueryError
      await expect(e.query({ type: "search", search: { query: "a", limit: -1 } })).rejects.toThrow(/Invalid limit/);
    }
  });
});
