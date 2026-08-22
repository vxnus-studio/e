import { test, describe, expect, beforeAll, afterAll } from "vitest";
import { InMemoryEngine } from "@vxnus/e";
import { SqliteEngine } from "@vxnus/e-sqlite";
import { PostgresEngine } from "@vxnus/e-postgres";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import Database from "better-sqlite3";

describe("Search Audit", () => {
  let pgPool: Pool;
  let memEngine: InMemoryEngine;
  let sqlEngine: SqliteEngine;
  let pgEngine: PostgresEngine;

  beforeAll(async () => {
    sqlEngine = new SqliteEngine(":memory:");

    pgEngine = new PostgresEngine({
      connectionString: process.env.TEST_DATABASE_URL || "postgres://postgres:postgres@localhost:5432/postgres"
    });
    pgPool = (pgEngine as any).pool as Pool;
    const schemaSql = fs.readFileSync(path.join(__dirname, "../../postgres/schema.sql"), "utf-8");
    await pgPool.query(schemaSql);
    await pgPool.query("TRUNCATE TABLE e_entities, e_aliases, e_relations, e_claims, e_documents CASCADE;");

    memEngine = new InMemoryEngine();
  });

  afterAll(async () => {
    sqlEngine.close();
    await pgEngine.close();
  });

  const insert = async (entity: any) => {
    memEngine.insertEntity(entity);
    sqlEngine.insertEntity(entity);
    await pgEngine.insertEntity(entity);
  };

  test("Insert test data", async () => {
    await insert({ id: "1", namespace: "ns", kind: "test", name: "Alpha", slug: "alpha", data: {} });
    await insert({ id: "2", namespace: "ns", kind: "test", name: "Beta", slug: "beta", data: {} });
    await insert({ id: "3", namespace: "ns", kind: "test", name: "Gamma", slug: "gamma", data: {} });
    await insert({ id: "4", namespace: "ns", kind: "test", name: "hello%world", slug: "hello-world", data: {} });
    await insert({ id: "5", namespace: "ns", kind: "test", name: "hello_world", slug: "hello-world-2", data: {} });
    await insert({ id: "6", namespace: "ns", kind: "test", name: "café", slug: "cafe", data: {} });
    await insert({ id: "7", namespace: "ns", kind: "test", name: "CAFE", slug: "cafe2", data: {} });
  });

  const runSearch = async (query: string, limit?: number) => {
    const memRes = await memEngine.query({ type: "search", search: { query, limit } });
    const sqlRes = await sqlEngine.query({ type: "search", search: { query, limit } });
    const pgRes = await pgEngine.query({ type: "search", search: { query, limit } });
    return {
      mem: memRes.search?.entities.map(e => e.id).sort() || [],
      sql: sqlRes.search?.entities.map(e => e.id).sort() || [],
      pg: pgRes.search?.entities.map(e => e.id).sort() || []
    };
  };

  test("Empty query", async () => {
    const res = await runSearch("");
    console.log("Empty query:", res);
  });

  test("Whitespace query", async () => {
    const res = await runSearch("   ");
    console.log("Whitespace query:", res);
  });

  test("Wildcard % query", async () => {
    const res = await runSearch("%");
    console.log("Wildcard % query:", res);
  });

  test("Wildcard _ query", async () => {
    const res = await runSearch("_");
    console.log("Wildcard _ query:", res);
  });

  test("Unicode é", async () => {
    const res = await runSearch("é");
    console.log("Unicode é:", res);
  });
  
  test("limit tests", async () => {
    console.log("limit 0:", await runSearch("a", 0));
    console.log("limit 1:", await runSearch("a", 1));
    console.log("limit 100:", await runSearch("a", 100));
    try {
      console.log("limit -1:", await runSearch("a", -1));
    } catch (e: any) {
      console.log("limit -1 threw:", e.message);
    }
  });
});
