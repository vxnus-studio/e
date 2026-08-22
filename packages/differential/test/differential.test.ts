import { test, expect, describe, beforeAll, afterAll, beforeEach } from "vitest";
import { InMemoryEngine } from "../../core/src/engine.js";
import { SqliteEngine } from "../../sqlite/src/index.js";
import { PostgresEngine } from "../../postgres/src/index.js";
import type { EQueryEngine, EFixtureMutator } from "../../core/src/types.js";
import { ConstraintError } from "../../core/src/errors.js";
import Database from "better-sqlite3";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

function createEmptyEntity(id: string, name: string = id) {
  return { id, namespace: "test", kind: "node", slug: name.toLowerCase(), name, data: {} };
}

interface TestBackend {
  name: string;
  engine: EQueryEngine & EFixtureMutator & { close?: () => Promise<void> | void };
  insert: (f: any) => Promise<void>;
  clear: () => Promise<void>;
}

describe("Differential Cross-Backend Semantic Parity", () => {
  let memEngine: InMemoryEngine;
  let sqliteEngine: SqliteEngine;
  let pgEngine: PostgresEngine;

  let engines: TestBackend[] = [];

  beforeAll(async () => {
    // 1. InMemory
    memEngine = new InMemoryEngine();
    engines.push({
      name: "InMemory",
      engine: memEngine,
      insert: async (f) => {
        // Harness invariant: Mutate via engine bound directly to this backend
        for (const e of (f.entities || [])) memEngine.insertEntity(e);
        for (const a of (f.aliases || [])) memEngine.insertAlias(a);
        for (const r of (f.relations || [])) memEngine.insertRelation(r);
        for (const c of (f.claims || [])) memEngine.insertClaim(c);
        for (const d of (f.documents || [])) memEngine.insertDocument(d);
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
          // Harness invariant: Mutate via engine bound directly to SQLite
          for (const e of (f.entities || [])) sqliteEngine.insertEntity(e);
          for (const a of (f.aliases || [])) sqliteEngine.insertAlias(a);
          for (const r of (f.relations || [])) sqliteEngine.insertRelation(r);
          for (const c of (f.claims || [])) sqliteEngine.insertClaim(c);
          for (const d of (f.documents || [])) sqliteEngine.insertDocument(d);
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
            // Harness invariant: Mutate via pgEngine bound directly to PostgreSQL
            for (const e of (f.entities || [])) await pgEngine.insertEntity(e);
            for (const a of (f.aliases || [])) await pgEngine.insertAlias(a);
            for (const r of (f.relations || [])) await pgEngine.insertRelation(r);
            for (const c of (f.claims || [])) await pgEngine.insertClaim(c);
            for (const d of (f.documents || [])) await pgEngine.insertDocument(d);
          },
          clear: async () => {
            await pool.query(`TRUNCATE TABLE e_entities, e_aliases, e_relations, e_claims, e_documents CASCADE;`);
          }
        });
    } catch (e) {
      if (process.env.CI) throw e;
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

  describe("0. Harness Integrity & Backend Isolation", () => {
    test("Harness invariant: each test backend mutates only its own storage", async () => {
      // Ensure all registered engines are distinct instances
      const engineInstances = engines.map(e => e.engine);
      const uniqueInstances = new Set(engineInstances);
      expect(uniqueInstances.size).toBe(engines.length);

      // Verify inserting into one backend does not bleed into another
      if (engines.length > 1) {
        await engines[0].insert({ entities: [createEmptyEntity("isolated-e1")] });
        const res0 = await engines[0].engine.query({ type: "getEntity", id: "isolated-e1" });
        expect(res0.entities?.length).toBe(1);

        for (let i = 1; i < engines.length; i++) {
          const resOther = await engines[i].engine.query({ type: "getEntity", id: "isolated-e1" });
          expect(resOther.entities?.length, `Engine ${engines[i].name} saw entity from ${engines[0].name}`).toBe(0);
        }
      }
    });
  });

  describe("1. Constraint Parity Matrix", () => {
    test("Duplicate Entity ID", async () => {
      for (const e of engines) {
        await e.insert({ entities: [createEmptyEntity("E1")] });
        try {
          await e.insert({ entities: [createEmptyEntity("E1")] });
          expect.fail(`Should have thrown ConstraintError on ${e.name}`);
        } catch(err: any) {
          expect(err.name).toBe("ConstraintError");
        }
      }
    });

    test("Duplicate Alias ID", async () => {
      for (const e of engines) {
        await e.insert({ entities: [createEmptyEntity("E1")] });
        await e.insert({ aliases: [{ id: "A1", entityId: "E1", alias: "one" }] });
        try {
          await e.insert({ aliases: [{ id: "A1", entityId: "E1", alias: "two" }] });
          expect.fail(`Should have thrown ConstraintError on ${e.name}`);
        } catch(err: any) {
          expect(err.name).toBe("ConstraintError");
        }
      }
    });

    test("Orphan Alias (Foreign Key)", async () => {
      for (const e of engines) {
        try {
          await e.insert({ aliases: [{ id: "A1", entityId: "MISSING", alias: "one" }] });
          expect.fail(`Should have thrown ConstraintError on ${e.name}`);
        } catch(err: any) {
          expect(err.name).toBe("ConstraintError");
        }
      }
    });

    test("Duplicate Relation ID", async () => {
      for (const e of engines) {
        await e.insert({ entities: [createEmptyEntity("E1"), createEmptyEntity("E2")] });
        await e.insert({ relations: [{ id: "R1", subjectId: "E1", predicate: "next", objectId: "E2" }] });
        try {
          await e.insert({ relations: [{ id: "R1", subjectId: "E1", predicate: "next", objectId: "E2" }] });
          expect.fail(`Should have thrown ConstraintError on ${e.name}`);
        } catch(err: any) {
          expect(err.name).toBe("ConstraintError");
        }
      }
    });

    test("Orphan Relation (Foreign Key)", async () => {
      for (const e of engines) {
        try {
          await e.insert({ relations: [{ id: "R1", subjectId: "MISSING", predicate: "next", objectId: "MISSING2" }] });
          expect.fail(`Should have thrown ConstraintError on ${e.name}`);
        } catch(err: any) {
          expect(err.name).toBe("ConstraintError");
        }
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
        expect(results[i]!.entities).toEqual(first!.entities);
        expect(results[i]!.relations).toEqual(first!.relations);
        expect(results[i]!.paths).toEqual(first!.paths);
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
        expect(results[i]!.paths).toEqual(first!.paths);
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
        
        expect(resExact.entities?.length).toBe(1);
        expect(resExact.entities?.[0].id).toBe("E1");
        // Contract: resolve is strictly case-sensitive across all backends
        expect(resLower.entities?.length).toBe(0);
      }
    });

    test("Resolution is alias-only, namespace-filtered, and ambiguity-preserving", async () => {
      for (const e of engines) {
        await e.insert({
          entities: [
            { id: "RES-A", namespace: "one", kind: "node", slug: "hidden-a", name: "Alias Name A", data: {}, identities: [{ provider: "p", externalId: "a" }] },
            { id: "RES-B", namespace: "two", kind: "node", slug: "hidden-b", name: "Alias Name B", data: {} },
          ],
          aliases: [
            { id: "RES-AL-A", entityId: "RES-A", alias: "shared" },
            { id: "RES-AL-B", entityId: "RES-B", alias: "shared" },
          ]
        });
        expect((await e.engine.query({ type: "resolve", alias: "shared" })).entities?.map((entity: any) => entity.id)).toEqual(["RES-A", "RES-B"]);
        expect((await e.engine.query({ type: "resolve", alias: "shared", namespace: "one" })).entities?.map((entity: any) => entity.id)).toEqual(["RES-A"]);
        expect((await e.engine.query({ type: "resolve", alias: "hidden-a" })).entities).toEqual([]);
        expect((await e.engine.query({ type: "resolve", alias: "Alias Name A" })).entities).toEqual([]);
      }
    });
  });

  describe("4. Randomized Bounded Property Testing", () => {
    function mulberry32(a: number) {
      return function() {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      }
    }
    
    test("Random graph traversal parity across deterministic seeds", async () => {
      for (const seed of [12345, 67890, 424242]) {
        const prefix = `R${seed}`;
        const rand = mulberry32(seed);
        const f: any = { entities: [], relations: [] };
        for (let i=0; i<10; i++) f.entities.push(createEmptyEntity(`${prefix}-N${i}`));
        for (let i=0; i<20; i++) {
          const sub = `${prefix}-N${Math.floor(rand() * 10)}`;
          const obj = `${prefix}-N${Math.floor(rand() * 10)}`;
          f.relations.push({ id: `${prefix}-R${i}`, subjectId: sub, predicate: "edge", objectId: obj });
        }

        const results = [];
        for (const e of engines) {
          await e.insert(f);
          const res = await e.engine.query({ type: "traverse", startId: `${prefix}-N0`, maxDepth: 3, maxPaths: 10 });
          results.push({ name: e.name, paths: res.traversal?.paths });
        }

        const memPaths = results[0].paths;
        for (let i = 1; i < results.length; i++) {
          expect(results[i].paths, `Mismatch for seed ${seed} in ${results[i].name}`).toEqual(memPaths);
        }
      }
    });
  });

  describe("5. Search Mode Semantics", () => {
    test("Lexical search works across all backends; unsupported semantic/hybrid modes throw", async () => {
      for (const e of engines) {
        await e.insert({ entities: [createEmptyEntity("E1", "Test Node")] });
        
        const resLexical = await e.engine.query({ type: "search", search: { query: "test", mode: "lexical" } });
        expect(resLexical.search?.entities.length).toBe(1);
        
        // Semantic mode must throw UnsupportedOperationError across all backends
        await expect(e.engine.query({ type: "search", search: { query: "test", mode: "semantic" } })).rejects.toThrow();
        await expect(e.engine.query({ type: "search", search: { query: "test", mode: "hybrid" } })).rejects.toThrow();
      }
    });
  });
});
