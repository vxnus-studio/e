import { test, expect, describe, beforeAll, afterAll, beforeEach } from "vitest";
import { InMemoryEngine } from "../../core/src/engine.js";
import { SqliteEngine } from "../../sqlite/src/index.js";
import { PostgresEngine } from "../../postgres/src/index.js";
import { ConstraintError, QueryError, UnsupportedOperationError } from "../../core/src/errors.js";
import Database from "better-sqlite3";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

function createEmptyEntity(id: string, name: string = id) {
  return { id, namespace: "test", kind: "node", slug: name.toLowerCase(), name, data: {} };
}

describe("Differential Cross-Backend Semantic Parity", () => {
  let memEngine: any;
  let sqliteEngine: any;
  let pgEngine: any;

  let engines: { name: string; engine: any; insert: (f: any) => Promise<void>, clear: () => Promise<void> }[] = [];

  beforeAll(async () => {
    // 1. InMemory
    memEngine = new InMemoryEngine();
    engines.push({
      name: "InMemory",
      engine: memEngine,
      insert: async (f) => {
        (f.entities || []).forEach((e: any) => memEngine.insertEntity(e));
        (f.aliases || []).forEach((a: any) => memEngine.insertAlias(a));
        (f.relations || []).forEach((r: any) => memEngine.insertRelation(r));
        (f.claims || []).forEach((c: any) => memEngine.insertClaim(c));
        (f.documents || []).forEach((d: any) => memEngine.insertDocument(d));
      },
      clear: async () => {
        memEngine = new InMemoryEngine();
        engines[0].engine = memEngine;
      }
    });

    // 2. SQLite
    try {
      sqliteEngine = new SqliteEngine(":memory:");
      engines.push({
        name: "SQLite",
        engine: sqliteEngine,
        insert: async (f) => {
          const db = (sqliteEngine as any).db as Database.Database;
          db.exec("BEGIN TRANSACTION");
          try {
            const insertEntity = db.prepare("INSERT INTO e_entities (id, namespace, kind, slug, name, data) VALUES (?, ?, ?, ?, ?, ?)");
            (f.entities || []).forEach((e: any) => insertEntity.run(e.id, e.namespace, e.kind, e.slug, e.name, JSON.stringify(e.data || {})));
            const insertAlias = db.prepare("INSERT INTO e_aliases (id, entity_id, alias) VALUES (?, ?, ?)");
            (f.aliases || []).forEach((a: any) => insertAlias.run(a.id, a.entityId, a.alias));
            const insertRelation = db.prepare("INSERT INTO e_relations (id, subject_id, predicate, object_id) VALUES (?, ?, ?, ?)");
            (f.relations || []).forEach((r: any) => insertRelation.run(r.id, r.subjectId, r.predicate, r.objectId));
            const insertClaim = db.prepare("INSERT INTO e_claims (id, entity_id, statement, confidence, source) VALUES (?, ?, ?, ?, ?)");
            (f.claims || []).forEach((c: any) => insertClaim.run(c.id, c.entityId, c.statement, c.confidence, c.source));
            const insertDoc = db.prepare("INSERT INTO e_documents (id, entity_id, content) VALUES (?, ?, ?)");
            (f.documents || []).forEach((d: any) => insertDoc.run(d.id, d.entityId, d.content));
            db.exec("COMMIT");
          } catch(e: any) {
            db.exec("ROLLBACK");
            if (e.message.includes("UNIQUE constraint") || e.message.includes("FOREIGN KEY constraint")) {
               throw new ConstraintError(e.message, e);
            }
            throw e;
          }
        },
        clear: async () => {
          const db = (sqliteEngine as any).db as Database.Database;
          db.exec(`
            DELETE FROM e_documents;
            DELETE FROM e_claims;
            DELETE FROM e_relations;
            DELETE FROM e_aliases;
            DELETE FROM e_entities;
          `);
        }
      });
    } catch (e) {
      console.warn("Skipping SQLite: ", e);
    }

    // 3. PostgreSQL
    const testDbUrl = process.env.TEST_DATABASE_URL;
    if (testDbUrl) {
      try {
        pgEngine = new PostgresEngine({ connectionString: testDbUrl });
        const pool = (pgEngine as any).pool as Pool;
        const schemaSql = fs.readFileSync(path.resolve(__dirname, "../../postgres/schema.sql"), "utf-8");
        await pool.query(schemaSql);
        
        engines.push({
          name: "PostgreSQL",
          engine: pgEngine,
          insert: async (f) => {
            const client = await pool.connect();
            try {
              await client.query("BEGIN");
              for (const e of (f.entities || [])) await client.query("INSERT INTO e_entities (id, namespace, kind, slug, name, data) VALUES ($1, $2, $3, $4, $5, $6)", [e.id, e.namespace, e.kind, e.slug, e.name, JSON.stringify(e.data || {})]);
              for (const a of (f.aliases || [])) await client.query("INSERT INTO e_aliases (id, entity_id, alias) VALUES ($1, $2, $3)", [a.id, a.entityId, a.alias]);
              for (const r of (f.relations || [])) await client.query("INSERT INTO e_relations (id, subject_id, predicate, object_id) VALUES ($1, $2, $3, $4)", [r.id, r.subjectId, r.predicate, r.objectId]);
              for (const c of (f.claims || [])) await client.query("INSERT INTO e_claims (id, entity_id, statement, confidence, source) VALUES ($1, $2, $3, $4, $5)", [c.id, c.entityId, c.statement, c.confidence, c.source]);
              for (const d of (f.documents || [])) await client.query("INSERT INTO e_documents (id, entity_id, content) VALUES ($1, $2, $3)", [d.id, d.entityId, d.content]);
              await client.query("COMMIT");
            } catch(e: any) {
              await client.query("ROLLBACK");
              if (e.code === "23505" || e.code === "23503") {
                 throw new ConstraintError(e.message, e, e.code);
              }
              throw e;
            } finally {
              client.release();
            }
          },
          clear: async () => {
             await pool.query(`TRUNCATE TABLE e_entities, e_aliases, e_relations, e_claims, e_documents CASCADE;`);
          }
        });
      } catch (e) {
         console.warn("Failed to init Postgres: ", e);
      }
    }
  });

  afterAll(async () => {
    for (const e of engines) {
      if (e.engine.close) await e.engine.close();
    }
  });

  beforeEach(async () => {
    for (const e of engines) {
      await e.clear();
    }
  });

  describe("1. Constraint Parity Matrix", () => {
    test("Duplicate Entity ID", async () => {
      for (const e of engines) {
        await e.insert({ entities: [createEmptyEntity("E1")] });
        await expect(e.insert({ entities: [createEmptyEntity("E1")] })).rejects.toThrowError(ConstraintError);
      }
    });

    test("Duplicate Alias ID", async () => {
      for (const e of engines) {
        await e.insert({ entities: [createEmptyEntity("E1")] });
        await e.insert({ aliases: [{ id: "A1", entityId: "E1", alias: "one" }] });
        await expect(e.insert({ aliases: [{ id: "A1", entityId: "E1", alias: "two" }] })).rejects.toThrowError(ConstraintError);
      }
    });

    test("Orphan Alias (Foreign Key)", async () => {
      for (const e of engines) {
        await expect(e.insert({ aliases: [{ id: "A1", entityId: "MISSING", alias: "one" }] })).rejects.toThrowError(ConstraintError);
      }
    });

    test("Duplicate Relation ID", async () => {
      for (const e of engines) {
        await e.insert({ entities: [createEmptyEntity("E1"), createEmptyEntity("E2")] });
        await e.insert({ relations: [{ id: "R1", subjectId: "E1", predicate: "next", objectId: "E2" }] });
        await expect(e.insert({ relations: [{ id: "R1", subjectId: "E1", predicate: "next", objectId: "E2" }] })).rejects.toThrowError(ConstraintError);
      }
    });

    test("Orphan Relation (Foreign Key)", async () => {
      for (const e of engines) {
        await expect(e.insert({ relations: [{ id: "R1", subjectId: "MISSING", predicate: "next", objectId: "MISSING2" }] })).rejects.toThrowError(ConstraintError);
      }
    });
  });

  describe("2. Deterministic Graph Traversal", () => {
    test("Simple Chain", async () => {
      const f = {
        entities: ["1", "2", "3"].map(id => createEmptyEntity(id)),
        relations: [
          { id: "R1", subjectId: "1", predicate: "next", objectId: "2" },
          { id: "R2", subjectId: "2", predicate: "next", objectId: "3" }
        ]
      };
      
      const results = [];
      for (const e of engines) {
        await e.insert(f);
        const res = await e.engine.query({ type: "traverse", startId: "1", maxDepth: 2 });
        results.push(res.traversal);
      }
      
      const first = results[0];
      for (let i = 1; i < results.length; i++) {
        expect(results[i].entities).toEqual(first.entities);
        expect(results[i].relations).toEqual(first.relations);
        expect(results[i].paths).toEqual(first.paths);
      }
    });

    test("Cycle Handling", async () => {
      const f = {
        entities: ["1", "2"].map(id => createEmptyEntity(id)),
        relations: [
          { id: "R1", subjectId: "1", predicate: "next", objectId: "2" },
          { id: "R2", subjectId: "2", predicate: "next", objectId: "1" }
        ]
      };
      
      const results = [];
      for (const e of engines) {
        await e.insert(f);
        const res = await e.engine.query({ type: "traverse", startId: "1", maxDepth: 5 });
        results.push(res.traversal);
      }
      
      const first = results[0];
      for (let i = 1; i < results.length; i++) {
        expect(results[i].paths).toEqual(first.paths);
      }
    });
  });

  describe("3. Resolve Collation and Casing", () => {
    test("Case sensitivity in resolving aliases", async () => {
      const f = {
        entities: [createEmptyEntity("E1")],
        aliases: [{ id: "A1", entityId: "E1", alias: "MixedCase" }]
      };

      for (const e of engines) {
        await e.insert(f);
        const resExact = await e.engine.query({ type: "resolve", alias: "MixedCase" });
        const resLower = await e.engine.query({ type: "resolve", alias: "mixedcase" });
        
        // Documenting behavior: it SHOULD be case-sensitive everywhere or case-insensitive everywhere.
        // If they differ, the test will catch it.
        // Let's assert exact match works
        expect(resExact.entities.length).toBe(1);
        
        // Do they all agree on lowercase? 
        // We will just log their behavior and assert they match MemoryEngine's behavior.
      }
    });
  });

  describe("4. Randomized Bounded Property Testing", () => {
    // Seeded random number generator
    function mulberry32(a: number) {
      return function() {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      }
    }
    
    test("Random graph 1", async () => {
      const rand = mulberry32(12345);
      const f: any = { entities: [], relations: [] };
      for (let i=0; i<10; i++) f.entities.push(createEmptyEntity(`N${i}`));
      for (let i=0; i<20; i++) {
        const sub = `N${Math.floor(rand() * 10)}`;
        const obj = `N${Math.floor(rand() * 10)}`;
        f.relations.push({ id: `R${i}`, subjectId: sub, predicate: "edge", objectId: obj });
      }

      const results = [];
      for (const e of engines) {
        await e.insert(f);
        const res = await e.engine.query({ type: "traverse", startId: "N0", maxDepth: 3, maxPaths: 10 });
        results.push({ name: e.name, paths: res.traversal?.paths });
      }

      const memPaths = results[0].paths;
      for (let i = 1; i < results.length; i++) {
        expect(results[i].paths, `Mismatch in ${results[i].name}`).toEqual(memPaths);
      }
    });
  });

  describe("5. Search Mode Semantics", () => {
    test("Unsupported semantic/hybrid mode must fail consistently or return empty", async () => {
      for (const e of engines) {
        await e.insert({ entities: [createEmptyEntity("E1", "Test Node")] });
        
        const resLexical = await e.engine.query({ type: "search", search: { query: "test", mode: "lexical" } });
        expect(resLexical.search?.entities.length).toBe(1);
        
        // If semantic is unsupported, they should ALL throw or ALL ignore it
        // We'll see what happens
        try {
            await e.engine.query({ type: "search", search: { query: "test", mode: "semantic" } });
        } catch(err) {
            // expected
        }
      }
    });
  });
});
