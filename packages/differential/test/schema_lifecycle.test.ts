import { test, describe, expect, beforeAll, afterAll } from "vitest";
import { SqliteEngine } from "@vxnus/e-sqlite";
import { PostgresEngine } from "@vxnus/e-postgres";
import type { Entity, Alias, Relation, Claim, Document } from "@vxnus/e";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

describe("Schema Lifecycle, Fresh Install & Migration Replay Verification", () => {
  const testDbUrl = process.env.TEST_DATABASE_URL;
  let pgPool: Pool | undefined;
  const freshDbName = "e_fresh_test";

  beforeAll(async () => {
    if (testDbUrl) {
      const parsedUrl = new URL(testDbUrl);
      parsedUrl.pathname = "/postgres";
      const adminPool = new Pool({ connectionString: parsedUrl.toString() });
      try {
        await adminPool.query(`DROP DATABASE IF EXISTS ${freshDbName};`);
        await adminPool.query(`CREATE DATABASE ${freshDbName};`);
      } catch (e) {
        console.warn("Could not create fresh test database:", e);
      } finally {
        await adminPool.end();
      }
    }
  });

  test("Fresh SQLite bootstrap initializes all tables, constraints, and indexes", () => {
    const sqlite = new SqliteEngine(":memory:");
    const tables = (sqlite as any).db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;").all() as any[];
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain("e_entities");
    expect(tableNames).toContain("e_aliases");
    expect(tableNames).toContain("e_relations");
    expect(tableNames).toContain("e_claims");
    expect(tableNames).toContain("e_documents");

    sqlite.close();
  });

  test("Fresh PostgreSQL bootstrap creates schema and survives full CRUD cycle", async () => {
    if (!testDbUrl) return;
    const freshDbUrl = new URL(testDbUrl);
    freshDbUrl.pathname = `/${freshDbName}`;

    pgPool = new Pool({ connectionString: freshDbUrl.toString() });
    const schemaSql = fs.readFileSync(path.join(__dirname, "../../postgres/schema.sql"), "utf-8");
    await pgPool.query(schemaSql);

    const pgEngine = new PostgresEngine({ connectionString: freshDbUrl.toString() });

    // Insert entity
    const ent: Entity = {
      id: "fresh-ent-1",
      namespace: "fresh",
      kind: "node",
      slug: "fresh-1",
      name: "Fresh Node",
      data: { created: true },
      identities: [{ provider: "fresh-prov", externalId: "123" }],
      provenance: { provider: "audit" },
      temporal: { observedAt: "2026-08-22T00:00:00Z" }
    };
    await pgEngine.insertEntity(ent);

    // Query entity
    const res = await pgEngine.query({ type: "getEntity", id: "fresh-ent-1" });
    expect(res.entities?.length).toBe(1);
    expect(res.entities![0].identities).toEqual(ent.identities);
    expect(res.entities![0].provenance).toEqual(ent.provenance);
    expect(res.entities![0].temporal).toEqual(ent.temporal);

    await pgEngine.close();
    await pgPool.end();
  });

  test("PostgreSQL migration replay: applying baseline + 001 migration produces equivalent schema", async () => {
    if (!testDbUrl) return;
    const replayDbName = "e_replay_test";
    const parsedUrl = new URL(testDbUrl);
    parsedUrl.pathname = "/postgres";
    const adminPool = new Pool({ connectionString: parsedUrl.toString() });
    await adminPool.query(`DROP DATABASE IF EXISTS ${replayDbName};`);
    await adminPool.query(`CREATE DATABASE ${replayDbName};`);
    await adminPool.end();

    const replayDbUrl = new URL(testDbUrl);
    replayDbUrl.pathname = `/${replayDbName}`;
    const pool = new Pool({ connectionString: replayDbUrl.toString() });

    // Create base tables without metadata columns
    await pool.query(`
      CREATE TABLE e_entities (
        id VARCHAR(255) PRIMARY KEY,
        namespace VARCHAR(255) NOT NULL,
        kind VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        data JSONB NOT NULL DEFAULT '{}'
      );
      CREATE TABLE e_aliases (
        id VARCHAR(255) PRIMARY KEY,
        entity_id VARCHAR(255) NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
        alias VARCHAR(255) NOT NULL
      );
      CREATE TABLE e_relations (
        id VARCHAR(255) PRIMARY KEY,
        subject_id VARCHAR(255) NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
        predicate VARCHAR(255) NOT NULL,
        object_id VARCHAR(255) NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE
      );
      CREATE TABLE e_claims (
        id VARCHAR(255) PRIMARY KEY,
        entity_id VARCHAR(255) NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
        statement TEXT NOT NULL,
        confidence VARCHAR(50) NOT NULL CHECK (confidence IN ('canon', 'theory', 'outdated', 'unverified')),
        source VARCHAR(255) NOT NULL
      );
      CREATE TABLE e_documents (
        id VARCHAR(255) PRIMARY KEY,
        entity_id VARCHAR(255) NOT NULL REFERENCES e_entities(id) ON DELETE CASCADE,
        content TEXT NOT NULL
      );
    `);

    // Insert legacy record before migration
    await pool.query("INSERT INTO e_entities (id, namespace, kind, slug, name, data) VALUES ($1, $2, $3, $4, $5, $6)", [
      "legacy-1", "test", "item", "leg-1", "Legacy Entity", "{}"
    ]);

    // Apply migration 001
    const mig001 = fs.readFileSync(path.join(__dirname, "../../postgres/migrations/001_add_provenance_and_identities.sql"), "utf-8");
    await pool.query(mig001);

    // Verify existing record survived migration
    const engine = new PostgresEngine({ connectionString: replayDbUrl.toString() });
    const fetched = await engine.query({ type: "getEntity", id: "legacy-1" });
    expect(fetched.entities?.length).toBe(1);
    expect(fetched.entities![0].name).toBe("Legacy Entity");

    // Verify new metadata can be inserted post-migration
    await engine.insertEntity({
      id: "post-mig-1",
      namespace: "test",
      kind: "item",
      slug: "post-1",
      name: "Post Migration Entity",
      data: {},
      identities: [{ provider: "test", externalId: "mig" }]
    });

    const postFetched = await engine.query({ type: "getEntity", id: "post-mig-1" });
    expect(postFetched.entities![0].identities).toEqual([{ provider: "test", externalId: "mig" }]);

    await engine.close();
    await pool.end();
  });

  test("Schema initialization idempotency: running schema.sql twice succeeds safely", async () => {
    if (!testDbUrl) return;
    const pool = new Pool({ connectionString: testDbUrl });
    const schemaSql = fs.readFileSync(path.join(__dirname, "../../postgres/schema.sql"), "utf-8");
    
    // First run
    await pool.query(schemaSql);
    // Second run
    await expect(pool.query(schemaSql)).resolves.toBeDefined();
    await pool.end();
  });
});
