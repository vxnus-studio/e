import { test, expect, describe } from "vitest";
import { SqliteEngine } from "../src/index.js";
import Database from "better-sqlite3";
import { runBehavioralTests, type Fixtures } from "../../core/test/behavior.js";

let canRun = true;
try {
  new Database(":memory:");
} catch (e) {
  canRun = false;
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
} else {
  describe.skip("SqliteEngine", () => {
    test("skipped", () => {});
  });
}
