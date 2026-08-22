import { test, describe, expect, beforeAll, afterAll } from "vitest";
import { InMemoryEngine } from "@vxnus/e";
import { SqliteEngine } from "@vxnus/e-sqlite";
import { PostgresEngine } from "@vxnus/e-postgres";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

describe("Error Contract & Boundary Validation Audit", () => {
  let memEngine: InMemoryEngine;
  let sqlEngine: SqliteEngine;
  let pgEngine: PostgresEngine | undefined;

  let engines: { name: string; engine: any; insert: (f: any) => Promise<void> }[] = [];

  beforeAll(async () => {
    memEngine = new InMemoryEngine();
    engines.push({
      name: "InMemory",
      engine: memEngine,
      insert: async (f) => {
        for (const e of (f.entities || [])) memEngine.insertEntity(e);
        for (const a of (f.aliases || [])) memEngine.insertAlias(a);
        for (const r of (f.relations || [])) memEngine.insertRelation(r);
        for (const c of (f.claims || [])) memEngine.insertClaim(c);
        for (const d of (f.documents || [])) memEngine.insertDocument(d);
      }
    });

    sqlEngine = new SqliteEngine(":memory:");
    engines.push({
      name: "SQLite",
      engine: sqlEngine,
      insert: async (f) => {
        for (const e of (f.entities || [])) sqlEngine.insertEntity(e);
        for (const a of (f.aliases || [])) sqlEngine.insertAlias(a);
        for (const r of (f.relations || [])) sqlEngine.insertRelation(r);
        for (const c of (f.claims || [])) sqlEngine.insertClaim(c);
        for (const d of (f.documents || [])) sqlEngine.insertDocument(d);
      }
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
          insert: async (f) => {
            for (const e of (f.entities || [])) await pgEngine!.insertEntity(e);
            for (const a of (f.aliases || [])) await pgEngine!.insertAlias(a);
            for (const r of (f.relations || [])) await pgEngine!.insertRelation(r);
            for (const c of (f.claims || [])) await pgEngine!.insertClaim(c);
            for (const d of (f.documents || [])) await pgEngine!.insertDocument(d);
          }
        });
      } catch (e) {
        console.warn("PostgreSQL not initialized: ", e);
      }
    }

    // Seed one entity for traversal boundary tests
    for (const e of engines) {
      await e.insert({ entities: [{ id: "trav-root", namespace: "ns", kind: "node", slug: "root", name: "Root", data: {} }] });
    }
  });

  afterAll(async () => {
    sqlEngine.close();
    if (pgEngine) await pgEngine.close();
  });

  test("Missing record queries return empty results rather than throwing errors", async () => {
    for (const e of engines) {
      const getRes = await e.engine.query({ type: "getEntity", id: "nonexistent-id" });
      expect(getRes.entities).toEqual([]);

      const resRes = await e.engine.query({ type: "resolve", alias: "nonexistent-alias" });
      expect(resRes.entities).toEqual([]);

      const relRes = await e.engine.query({ type: "findRelations", subjectId: "nonexistent-id" });
      expect(relRes.relations).toEqual([]);

      const claimRes = await e.engine.query({ type: "findClaims", entityId: "nonexistent-id" });
      expect(claimRes.claims).toEqual([]);

      const docRes = await e.engine.query({ type: "findDocuments", entityId: "nonexistent-id" });
      expect(docRes.documents).toEqual([]);

      const travRes = await e.engine.query({ type: "traverse", startId: "nonexistent-id" });
      expect(travRes.traversal?.entities).toEqual([]);
      expect(travRes.traversal?.paths).toEqual([]);
    }
  });

  test("Invalid findRelations parameters (neither subjectId nor objectId) throws QueryError", async () => {
    for (const e of engines) {
      await expect(e.engine.query({ type: "findRelations" } as any)).rejects.toThrow(/requires at least subjectId or objectId/);
    }
  });

  test("Unknown query type throws UnsupportedOperationError across all backends", async () => {
    for (const e of engines) {
      try {
        await e.engine.query({ type: "invalidType" } as any);
        expect.fail(`Engine ${e.name} should throw UnsupportedOperationError`);
      } catch (err: any) {
        expect(err.name).toBe("UnsupportedOperationError");
      }
    }
  });

  test("Invalid traversal limits throw QueryError regardless of whether start entity exists", async () => {
    for (const e of engines) {
      // 1. When start entity exists
      await expect(e.engine.query({ type: "traverse", startId: "trav-root", maxDepth: -1 })).rejects.toThrow(/Invalid maxDepth/);
      await expect(e.engine.query({ type: "traverse", startId: "trav-root", maxDepth: 101 })).rejects.toThrow(/Invalid maxDepth/);
      await expect(e.engine.query({ type: "traverse", startId: "trav-root", maxDepth: 1.5 })).rejects.toThrow(/Invalid maxDepth/);
      await expect(e.engine.query({ type: "traverse", startId: "trav-root", maxPaths: -1 })).rejects.toThrow(/Invalid maxPaths/);
      await expect(e.engine.query({ type: "traverse", startId: "trav-root", maxPaths: 100001 })).rejects.toThrow(/Invalid maxPaths/);

      // 2. When start entity does NOT exist: Validation occurs before lookup (Uniform across all engines)
      await expect(e.engine.query({ type: "traverse", startId: "nonexistent-entity", maxDepth: -1 })).rejects.toThrow(/Invalid maxDepth/);
      await expect(e.engine.query({ type: "traverse", startId: "nonexistent-entity", maxPaths: -1 })).rejects.toThrow(/Invalid maxPaths/);
    }
  });

  test("Malformed root query request throws QueryError", async () => {
    for (const e of engines) {
      try {
        await e.engine.query(null as any);
        expect.fail(`Engine ${e.name} should throw QueryError for null query request`);
      } catch (err: any) {
        expect(err.name).toBe("QueryError");
      }

      try {
        await e.engine.query("string-query" as any);
        expect.fail(`Engine ${e.name} should throw QueryError for non-object query request`);
      } catch (err: any) {
        expect(err.name).toBe("QueryError");
      }
    }
  });

  test("Constraint violations throw ConstraintError", async () => {
    for (const e of engines) {
      const ent = { id: "ent-err-1", namespace: "ns", kind: "node", slug: "err1", name: "Err 1", data: {} };
      await e.insert({ entities: [ent] });

      // Duplicate entity ID
      try {
        await e.insert({ entities: [ent] });
        expect.fail(`Should throw ConstraintError on ${e.name}`);
      } catch (err: any) {
        expect(err.name).toBe("ConstraintError");
      }

      // Foreign key violation for alias
      try {
        await e.insert({ aliases: [{ id: "a-orphan", entityId: "missing-entity", alias: "alias" }] });
        expect.fail(`Should throw ConstraintError on ${e.name}`);
      } catch (err: any) {
        expect(err.name).toBe("ConstraintError");
      }
    }
  });
});
