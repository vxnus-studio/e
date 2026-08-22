import { test, describe, expect, beforeAll, afterAll } from "vitest";
import { InMemoryEngine } from "@vxnus/e";
import { SqliteEngine } from "@vxnus/e-sqlite";
import { PostgresEngine } from "@vxnus/e-postgres";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

describe("Unicode & Search Collation Differential Truth", () => {
  let pgPool: Pool | undefined;
  let memEngine: InMemoryEngine;
  let sqlEngine: SqliteEngine;
  let pgEngine: PostgresEngine | undefined;

  beforeAll(async () => {
    sqlEngine = new SqliteEngine(":memory:");
    memEngine = new InMemoryEngine();

    const testDbUrl = process.env.TEST_DATABASE_URL;
    if (testDbUrl) {
      try {
        pgEngine = new PostgresEngine({ connectionString: testDbUrl });
        pgPool = (pgEngine as any).pool as Pool;
        const schemaSql = fs.readFileSync(path.join(__dirname, "../../postgres/schema.sql"), "utf-8");
        await pgPool.query(schemaSql);
        await pgPool.query("TRUNCATE TABLE e_entities, e_aliases, e_relations, e_claims, e_documents CASCADE;");
      } catch (e) {
        if (process.env.CI) throw e;
        console.warn("PostgreSQL not initialized: ", e);
      }
    }

    const insert = async (entity: any) => {
      memEngine.insertEntity(entity);
      sqlEngine.insertEntity(entity);
      if (pgEngine) await pgEngine.insertEntity(entity);
    };

    await insert({ id: "1", namespace: "ns", kind: "test", name: "café", slug: "cafe1", data: {} });
    await insert({ id: "2", namespace: "ns", kind: "test", name: "CAFE", slug: "cafe2", data: {} });
    await insert({ id: "3", namespace: "ns", kind: "test", name: "Éclair", slug: "eclair", data: {} });
    await insert({ id: "4", namespace: "ns", kind: "test", name: "éclair", slug: "eclair2", data: {} });
  });

  afterAll(async () => {
    sqlEngine.close();
    if (pgEngine) await pgEngine.close();
  });

  test("ASCII query on accented data matches only exact ASCII/stripped representations", async () => {
    const memRes = await memEngine.query({ type: "search", search: { query: "cafe" } });
    const sqlRes = await sqlEngine.query({ type: "search", search: { query: "cafe" } });

    // 'cafe' matches 'café' (via slug 'cafe1') and 'CAFE' (via name & slug 'cafe2')
    expect(memRes.search?.entities.map(e => e.id).sort()).toEqual(["1", "2"]);
    expect(sqlRes.search?.entities.map(e => e.id).sort()).toEqual(["1", "2"]);

    if (pgEngine) {
      const pgRes = await pgEngine.query({ type: "search", search: { query: "cafe" } });
      expect(pgRes.search?.entities.map(e => e.id).sort()).toEqual(["1", "2"]);
    }
  });

  test("Accented query differential behavior: InMemory and PostgreSQL fold Unicode, SQLite LIKE is ASCII-only", async () => {
    // Querying with uppercase accented 'CAFÉ'
    const memRes = await memEngine.query({ type: "search", search: { query: "CAFÉ" } });
    const sqlRes = await sqlEngine.query({ type: "search", search: { query: "CAFÉ" } });

    // In-memory JavaScript toLowerCase() folds 'CAFÉ' -> 'café', matching entity '1'
    expect(memRes.search?.entities.map(e => e.id)).toEqual(["1"]);

    // SQLite standard LIKE does NOT fold Unicode uppercase 'É' to 'é'
    // This is a documented backend capability limit of SQLite standard collation
    expect(sqlRes.search?.entities.map(e => e.id)).toEqual([]);

    if (pgEngine) {
      const pgRes = await pgEngine.query({ type: "search", search: { query: "CAFÉ" } });
      // PostgreSQL ILIKE folds full UTF-8 Unicode, matching entity '1'
      expect(pgRes.search?.entities.map(e => e.id)).toEqual(["1"]);
    }
  });

  test("Accented query 'éclair' matches exact accented lowercase across all backends", async () => {
    const memRes = await memEngine.query({ type: "search", search: { query: "éclair" } });
    const sqlRes = await sqlEngine.query({ type: "search", search: { query: "éclair" } });

    // 'éclair' matches entity '3' (slug: eclair, name: Éclair folded in JS) and entity '4' (name: éclair)
    expect(memRes.search?.entities.map(e => e.id).sort()).toEqual(["3", "4"]);
    // SQLite matches entity '4' (exact 'éclair') but cannot fold 'Éclair' in entity '3'
    expect(sqlRes.search?.entities.map(e => e.id)).toEqual(["4"]);

    if (pgEngine) {
      const pgRes = await pgEngine.query({ type: "search", search: { query: "éclair" } });
      expect(pgRes.search?.entities.map(e => e.id).sort()).toEqual(["3", "4"]);
    }
  });
});
