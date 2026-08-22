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

      try {
        await e.engine.query([] as any);
        expect.fail(`Engine ${e.name} should throw QueryError for array query request`);
      } catch (err: any) {
        expect(err.name).toBe("QueryError");
      }
    }
  });

  test("Runtime query input validation: malformed nested fields throw QueryError uniformly", async () => {
    for (const e of engines) {
      // 1. Search with non-string query
      await expect(e.engine.query({ type: "search", search: { query: 123 as any } })).rejects.toThrow(/Invalid search query/);
      await expect(e.engine.query({ type: "search", search: { query: null as any } })).rejects.toThrow(/Invalid search query/);
      await expect(e.engine.query({ type: "search", search: null as any })).rejects.toThrow(/Search query must be a non-null object/);
      await expect(e.engine.query({ type: "search", search: { query: "ok", namespace: 123 as any } })).rejects.toThrow(/Invalid search namespace/);
      await expect(e.engine.query({ type: "search", search: { query: "ok", kind: "" } })).rejects.toThrow(/Invalid search kind/);
      await expect(e.engine.query({ type: "search", search: { query: "ok", mode: "banana" as any } })).rejects.toThrow(/Invalid search mode/);

      // 2. Resolve with empty/whitespace alias or invalid namespace
      await expect(e.engine.query({ type: "resolve", alias: "" })).rejects.toThrow(/Invalid alias/);
      await expect(e.engine.query({ type: "resolve", alias: "   " })).rejects.toThrow(/Invalid alias/);
      await expect(e.engine.query({ type: "resolve", alias: 123 as any })).rejects.toThrow(/Invalid alias/);
      await expect(e.engine.query({ type: "resolve", alias: "ok", namespace: "" })).rejects.toThrow(/Invalid namespace/);

      // 3. getEntity with non-string or empty id
      await expect(e.engine.query({ type: "getEntity", id: "" })).rejects.toThrow(/Invalid id/);
      await expect(e.engine.query({ type: "getEntity", id: 123 as any })).rejects.toThrow(/Invalid id/);

      // 4. findClaims / findDocuments with invalid entityId
      await expect(e.engine.query({ type: "findClaims", entityId: "" })).rejects.toThrow(/Invalid entityId/);
      await expect(e.engine.query({ type: "findClaims", entityId: 123 as any })).rejects.toThrow(/Invalid entityId/);
      await expect(e.engine.query({ type: "findDocuments", entityId: "" })).rejects.toThrow(/Invalid entityId/);
      await expect(e.engine.query({ type: "findDocuments", entityId: {} as any })).rejects.toThrow(/Invalid entityId/);

      // 5. findRelations with invalid field types
      await expect(e.engine.query({ type: "findRelations", subjectId: 123 as any })).rejects.toThrow(/Invalid subjectId/);
      await expect(e.engine.query({ type: "findRelations", objectId: "" as any })).rejects.toThrow(/Invalid objectId/);
      await expect(e.engine.query({ type: "findRelations", subjectId: "a", predicate: 123 as any })).rejects.toThrow(/Invalid predicate/);

      // 6. Traverse with invalid startId, steps, or step direction
      await expect(e.engine.query({ type: "traverse", startId: 123 as any })).rejects.toThrow(/Invalid startId/);
      await expect(e.engine.query({ type: "traverse", startId: "ok", steps: "out" as any })).rejects.toThrow(/Invalid traversal steps/);
      await expect(e.engine.query({ type: "traverse", startId: "ok", steps: [{ direction: "banana" as any }] })).rejects.toThrow(/direction 'banana'/);
      await expect(e.engine.query({ type: "traverse", startId: "ok", steps: [{ direction: "out", predicates: [123 as any] }] })).rejects.toThrow(/Invalid predicate in step/);
      await expect(e.engine.query({ type: "traverse", startId: "ok", predicates: "links" as any })).rejects.toThrow(/Invalid predicates/);
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

  test("Input validation rejection parity: empty and whitespace fields throw ConstraintError across all engines", async () => {
    for (const e of engines) {
      // 1. Empty/Whitespace Entity ID
      await expect(async () => {
        await e.engine.insertEntity({ id: "", namespace: "ns", kind: "node", slug: "slug", name: "Name", data: {} });
      }).rejects.toThrow();

      await expect(async () => {
        await e.engine.insertEntity({ id: "   ", namespace: "ns", kind: "node", slug: "slug", name: "Name", data: {} });
      }).rejects.toThrow();

      // 2. Empty/Whitespace Entity Namespace
      await expect(async () => {
        await e.engine.insertEntity({ id: "ent-valid", namespace: "", kind: "node", slug: "slug", name: "Name", data: {} });
      }).rejects.toThrow();

      // 3. Empty/Whitespace Entity Kind
      await expect(async () => {
        await e.engine.insertEntity({ id: "ent-valid", namespace: "ns", kind: "  ", slug: "slug", name: "Name", data: {} });
      }).rejects.toThrow();

      // 4. Empty/Whitespace Entity Slug
      await expect(async () => {
        await e.engine.insertEntity({ id: "ent-valid", namespace: "ns", kind: "node", slug: "", name: "Name", data: {} });
      }).rejects.toThrow();

      // 5. Empty/Whitespace Alias
      await expect(async () => {
        await e.engine.insertAlias({ id: "al-1", entityId: "trav-root", alias: "" });
      }).rejects.toThrow();

      await expect(async () => {
        await e.engine.insertAlias({ id: "al-1", entityId: "trav-root", alias: "   " });
      }).rejects.toThrow();

      // 6. Empty/Whitespace Relation Predicate
      await expect(async () => {
        await e.engine.insertRelation({ id: "rel-1", subjectId: "trav-root", predicate: "", objectId: "trav-root" });
      }).rejects.toThrow();

      // 7. Invalid Claim Confidence level
      await expect(async () => {
        await e.engine.insertClaim({
          id: "cl-inv",
          entityId: "trav-root",
          statement: "Invalid confidence statement",
          confidence: "not-a-valid-level" as any,
          source: "Source"
        });
      }).rejects.toThrow();

      // 8. Empty/Whitespace Claim Statement
      await expect(async () => {
        await e.engine.insertClaim({
          id: "cl-empty",
          entityId: "trav-root",
          statement: "   ",
          confidence: "canon",
          source: "Source"
        });
      }).rejects.toThrow();

      // 9. Malformed Document (missing content string)
      await expect(async () => {
        await e.engine.insertDocument({
          id: "doc-bad",
          entityId: "trav-root",
          content: 123 as any
        });
      }).rejects.toThrow();
    }
  });

  test("Deterministic query result ordering: out-of-order inserts return canonical ID sorted results", async () => {
    for (const e of engines) {
      // Insert entities out of alphabetical order: z, a, m
      const entZ = { id: "ord-ent-z", namespace: "ord", kind: "node", slug: "z", name: "Z", data: {} };
      const entA = { id: "ord-ent-a", namespace: "ord", kind: "node", slug: "a", name: "A", data: {} };
      const entM = { id: "ord-ent-m", namespace: "ord", kind: "node", slug: "m", name: "M", data: {} };

      await e.engine.insertEntity(entZ);
      await e.engine.insertEntity(entA);
      await e.engine.insertEntity(entM);

      // Insert aliases pointing to same alias name out of order
      await e.engine.insertAlias({ id: "al-z", entityId: "ord-ent-z", alias: "common-alias" });
      await e.engine.insertAlias({ id: "al-a", entityId: "ord-ent-a", alias: "common-alias" });
      await e.engine.insertAlias({ id: "al-m", entityId: "ord-ent-m", alias: "common-alias" });

      // 1. Resolve must return entities sorted by id ASC
      const resResolve = await e.engine.query({ type: "resolve", alias: "common-alias" });
      expect(resResolve.entities?.map((ent: any) => ent.id)).toEqual(["ord-ent-a", "ord-ent-m", "ord-ent-z"]);

      // 2. Relations inserted out of order
      await e.engine.insertRelation({ id: "rel-z", subjectId: "ord-ent-a", predicate: "links", objectId: "ord-ent-z" });
      await e.engine.insertRelation({ id: "rel-a", subjectId: "ord-ent-a", predicate: "links", objectId: "ord-ent-m" });
      await e.engine.insertRelation({ id: "rel-m", subjectId: "ord-ent-a", predicate: "links", objectId: "ord-ent-a" });

      const resRel = await e.engine.query({ type: "findRelations", subjectId: "ord-ent-a" });
      expect(resRel.relations?.map((r: any) => r.id)).toEqual(["rel-a", "rel-m", "rel-z"]);
      expect(resRel.entities?.map((ent: any) => ent.id)).toEqual(["ord-ent-a", "ord-ent-m", "ord-ent-z"]);

      // 3. Claims inserted out of order
      await e.engine.insertClaim({ id: "cl-z", entityId: "ord-ent-a", statement: "Z claim", confidence: "canon", source: "src" });
      await e.engine.insertClaim({ id: "cl-a", entityId: "ord-ent-a", statement: "A claim", confidence: "canon", source: "src" });
      await e.engine.insertClaim({ id: "cl-m", entityId: "ord-ent-a", statement: "M claim", confidence: "canon", source: "src" });

      const resClaims = await e.engine.query({ type: "findClaims", entityId: "ord-ent-a" });
      expect(resClaims.claims?.map((c: any) => c.id)).toEqual(["cl-a", "cl-m", "cl-z"]);

      // 4. Documents inserted out of order
      await e.engine.insertDocument({ id: "doc-z", entityId: "ord-ent-a", content: "Z doc" });
      await e.engine.insertDocument({ id: "doc-a", entityId: "ord-ent-a", content: "A doc" });
      await e.engine.insertDocument({ id: "doc-m", entityId: "ord-ent-a", content: "M doc" });

      const resDocs = await e.engine.query({ type: "findDocuments", entityId: "ord-ent-a" });
      expect(resDocs.documents?.map((d: any) => d.id)).toEqual(["doc-a", "doc-m", "doc-z"]);
    }
  });

  test("Relation, claim, and document queries are explicitly bounded", async () => {
    for (const e of engines) {
      await e.engine.insertEntity({ id: "bounded-root", namespace: "bounded", kind: "node", slug: "bounded-root", name: "Bounded", data: {} });
      await e.engine.insertEntity({ id: "bounded-child", namespace: "bounded", kind: "node", slug: "bounded-child", name: "Child", data: {} });
      await e.engine.insertRelation({ id: "bounded-r-2", subjectId: "bounded-root", predicate: "links", objectId: "bounded-child" });
      await e.engine.insertRelation({ id: "bounded-r-1", subjectId: "bounded-root", predicate: "links", objectId: "bounded-root" });
      await e.engine.insertClaim({ id: "bounded-c-2", entityId: "bounded-root", statement: "two", confidence: "canon", source: "test" });
      await e.engine.insertClaim({ id: "bounded-c-1", entityId: "bounded-root", statement: "one", confidence: "canon", source: "test" });
      await e.engine.insertDocument({ id: "bounded-d-2", entityId: "bounded-root", content: "two" });
      await e.engine.insertDocument({ id: "bounded-d-1", entityId: "bounded-root", content: "one" });

      const relations = await e.engine.query({ type: "findRelations", subjectId: "bounded-root", limit: 1 });
      expect(relations.relations?.map((r: any) => r.id), `Engine ${e.name}`).toEqual(["bounded-r-1"]);
      expect(relations.metadata.partial).toBe(true);
      expect((await e.engine.query({ type: "findClaims", entityId: "bounded-root", limit: 1 })).claims?.map((c: any) => c.id)).toEqual(["bounded-c-1"]);
      expect((await e.engine.query({ type: "findDocuments", entityId: "bounded-root", limit: 1 })).documents?.map((d: any) => d.id)).toEqual(["bounded-d-1"]);
      expect((await e.engine.query({ type: "findClaims", entityId: "bounded-root", limit: 0 })).claims).toEqual([]);
    }
  });
});
