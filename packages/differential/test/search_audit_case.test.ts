import { test, beforeAll, afterAll } from "vitest";
import { InMemoryEngine } from "e";
import { SqliteEngine } from "@e/sqlite";
import { PostgresEngine } from "@e/postgres";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

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

  const insert = async (entity: any) => {
    memEngine.insertEntity(entity);
    sqlEngine.insertEntity(entity);
    await pgEngine.insertEntity(entity);
  };
  await insert({ id: "1", namespace: "ns", kind: "test", name: "café", slug: "cafe1", data: {} });
  await insert({ id: "2", namespace: "ns", kind: "test", name: "CAFE", slug: "cafe2", data: {} });
  await insert({ id: "3", namespace: "ns", kind: "test", name: "Éclair", slug: "eclair", data: {} });
  await insert({ id: "4", namespace: "ns", kind: "test", name: "éclair", slug: "eclair2", data: {} });
});

afterAll(async () => {
  sqlEngine.close();
  await pgEngine.close();
});

const runSearch = async (query: string) => {
  const memRes = await memEngine.query({ type: "search", search: { query } });
  const sqlRes = await sqlEngine.query({ type: "search", search: { query } });
  const pgRes = await pgEngine.query({ type: "search", search: { query } });
  return {
    mem: memRes.search?.entities.map(e => e.id).sort() || [],
    sql: sqlRes.search?.entities.map(e => e.id).sort() || [],
    pg: pgRes.search?.entities.map(e => e.id).sort() || []
  };
};

test("Case insensitivity test", async () => {
  console.log("query 'cafe':", await runSearch("cafe"));
  console.log("query 'CAFE':", await runSearch("CAFE"));
  console.log("query 'café':", await runSearch("café"));
  console.log("query 'CAFÉ':", await runSearch("CAFÉ"));
  console.log("query 'eclair':", await runSearch("eclair"));
  console.log("query 'ECLAIR':", await runSearch("ECLAIR"));
  console.log("query 'éclair':", await runSearch("éclair"));
  console.log("query 'ÉCLAIR':", await runSearch("ÉCLAIR"));
});
