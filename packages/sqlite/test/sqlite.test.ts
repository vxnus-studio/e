import { test, expect, describe } from "vitest";
import { SqliteEngine } from "../src/index.js";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runBehavioralTests, type Fixtures } from "../../core/test/behavior.js";
import { StorageError } from "@vxnus/e";

let canRun = true;
try {
  new Database(":memory:");
} catch (e) {
  canRun = false;
  if (process.env.CI) {
    throw new Error("better-sqlite3 native bindings could not be loaded in CI.");
  }
  console.warn("Skipping SqliteEngine tests because better-sqlite3 native bindings could not be loaded.");
}

if (canRun) {
  runBehavioralTests("SqliteEngine", async () => {
    const engine = new SqliteEngine(":memory:");
    const db = (engine as any).db as Database.Database;

    const insertFixtures = async (f: Fixtures) => {
      const insertEntity = db.prepare("INSERT INTO e_entities (id, namespace, kind, slug, name, data) VALUES (?, ?, ?, ?, ?, ?)");
      f.entities.forEach(e => insertEntity.run(e.id, e.namespace, e.kind, e.slug, e.name, JSON.stringify(e.data)));

      const insertAlias = db.prepare("INSERT INTO e_aliases (id, entity_id, alias) VALUES (?, ?, ?)");
      f.aliases.forEach(a => insertAlias.run(a.id, a.entityId, a.alias));

      const insertRelation = db.prepare("INSERT INTO e_relations (id, subject_id, predicate, object_id) VALUES (?, ?, ?, ?)");
      f.relations.forEach(r => insertRelation.run(r.id, r.subjectId, r.predicate, r.objectId));

      const insertClaim = db.prepare("INSERT INTO e_claims (id, entity_id, statement, confidence, source) VALUES (?, ?, ?, ?, ?)");
      f.claims.forEach(c => insertClaim.run(c.id, c.entityId, c.statement, c.confidence, c.source));

      const insertDoc = db.prepare("INSERT INTO e_documents (id, entity_id, content) VALUES (?, ?, ?)");
      f.documents.forEach(d => insertDoc.run(d.id, d.entityId, d.content));
    };

    const teardown = async () => {
      engine.close();
    };

    return { engine, insertFixtures, teardown };
  });
  describe.runIf(canRun)("SqliteEngine Specifics", () => {
    test("Foreign key constraint and cascade", () => {
      const engine = new SqliteEngine(":memory:");
      const db = (engine as any).db as Database.Database;

      const insertEntity = db.prepare("INSERT INTO e_entities (id, namespace, kind, slug, name, data) VALUES (?, ?, ?, ?, ?, ?)");
      insertEntity.run("parent", "ns", "node", "p", "Parent", "{}");

      const insertRelation = db.prepare("INSERT INTO e_relations (id, subject_id, predicate, object_id) VALUES (?, ?, ?, ?)");
      insertRelation.run("rel1", "parent", "owns", "parent"); // self-relation valid

      expect(() => {
        insertRelation.run("rel2", "missing", "owns", "parent");
      }).toThrow(/FOREIGN KEY constraint failed/);

      // Cascade delete
      db.prepare("DELETE FROM e_entities WHERE id = 'parent'").run();
      const relationsCount = db.prepare("SELECT count(*) as c FROM e_relations").get() as any;
      expect(relationsCount.c).toBe(0);

      engine.close();
    });

    test("Schema enforces the same 255-character storage boundary as validation", () => {
      const engine = new SqliteEngine(":memory:");
      const db = (engine as any).db as Database.Database;
      const insertEntity = db.prepare("INSERT INTO e_entities (id, namespace, kind, slug, name, data) VALUES (?, ?, ?, ?, ?, ?)");
      const valid = "x".repeat(255);
      insertEntity.run(valid, "ns", "node", "slug", "name", "{}");
      expect(() => insertEntity.run("too-long", "ns", "node", "slug", "y".repeat(256), "{}")).toThrow(/CHECK constraint failed/);
      engine.close();
    });

    test("Closed database failures are StorageError, not QueryError", async () => {
      const engine = new SqliteEngine(":memory:");
      engine.close();
      await expect(engine.query({ type: "getEntity", id: "missing" })).rejects.toBeInstanceOf(StorageError);
    });

    test("Versioned migration upgrades a legacy database and is replay-safe", () => {
      const filename = path.join(os.tmpdir(), `e-migration-${process.pid}-${Date.now()}.db`);
      const legacy = new Database(filename);
      legacy.exec(`
        CREATE TABLE e_entities (id TEXT PRIMARY KEY, namespace TEXT NOT NULL, kind TEXT NOT NULL, slug TEXT NOT NULL, name TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}');
        CREATE TABLE e_aliases (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL REFERENCES e_entities(id), alias TEXT NOT NULL);
        CREATE TABLE e_relations (id TEXT PRIMARY KEY, subject_id TEXT NOT NULL REFERENCES e_entities(id), predicate TEXT NOT NULL, object_id TEXT NOT NULL REFERENCES e_entities(id));
        CREATE TABLE e_claims (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL REFERENCES e_entities(id), statement TEXT NOT NULL, confidence TEXT NOT NULL, source TEXT NOT NULL);
        CREATE TABLE e_documents (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL REFERENCES e_entities(id), content TEXT NOT NULL);
        INSERT INTO e_entities (id, namespace, kind, slug, name, data) VALUES ('legacy', 'test', 'node', 'legacy', 'Legacy', '{}');
      `);
      legacy.close();

      const engine = new SqliteEngine(filename);
      const db = (engine as any).db as Database.Database;
      expect(db.prepare("SELECT version, name FROM e_schema_migrations").get()).toEqual({
        version: 1,
        name: "add_provenance_and_identities",
      });
      expect((db.prepare("PRAGMA table_info(e_entities)").all() as any[]).map((column) => column.name)).toContain("identities");
      expect(db.prepare("SELECT name FROM e_entities WHERE id = 'legacy'").get()).toEqual({ name: "Legacy" });
      engine.close();

      const replay = new SqliteEngine(filename);
      const replayDb = (replay as any).db as Database.Database;
      expect(replayDb.prepare("SELECT count(*) AS count FROM e_schema_migrations").get()).toEqual({ count: 1 });
      replay.close();
      fs.unlinkSync(filename);
    });

    test("Recorded migration with an incompatible schema fails closed", () => {
      const filename = path.join(os.tmpdir(), `e-migration-bad-${process.pid}-${Date.now()}.db`);
      const legacy = new Database(filename);
      legacy.exec(`
        CREATE TABLE e_entities (id TEXT PRIMARY KEY, namespace TEXT NOT NULL, kind TEXT NOT NULL, slug TEXT NOT NULL, name TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}');
        CREATE TABLE e_aliases (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, alias TEXT NOT NULL);
        CREATE TABLE e_relations (id TEXT PRIMARY KEY, subject_id TEXT NOT NULL, predicate TEXT NOT NULL, object_id TEXT NOT NULL);
        CREATE TABLE e_claims (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, statement TEXT NOT NULL, confidence TEXT NOT NULL, source TEXT NOT NULL);
        CREATE TABLE e_documents (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, content TEXT NOT NULL);
        CREATE TABLE e_schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);
        INSERT INTO e_schema_migrations VALUES (1, 'add_provenance_and_identities', '2026-08-22T00:00:00.000Z');
      `);
      legacy.close();

      expect(() => new SqliteEngine(filename)).toThrowError(/required columns are missing/);
      fs.unlinkSync(filename);
    });
  });
} else {
  describe.skip("SqliteEngine", () => {
    test("skipped", () => {});
  });
}
