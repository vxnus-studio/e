import { test, expect, describe } from "vitest";
import { PostgresEngine } from "../src/index.js";
import { runBehavioralTests, type Fixtures } from "../../core/test/behavior.js";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

const testDbUrl = process.env.TEST_DATABASE_URL;

if (testDbUrl) {
  runBehavioralTests("PostgresEngine", async () => {
    const engine = new PostgresEngine({ connectionString: testDbUrl });
    const pool = (engine as any).pool as Pool;

    // init schema
    const schemaSql = fs.readFileSync(path.join(__dirname, "../schema.sql"), "utf-8");
    await pool.query(schemaSql);

    // clear tables for test isolation
    await pool.query(`TRUNCATE TABLE e_entities, e_aliases, e_relations, e_claims, e_documents CASCADE;`);

    const insertFixtures = async (f: Fixtures) => {
      for (const e of f.entities) {
        await pool.query("INSERT INTO e_entities (id, namespace, kind, slug, name, data) VALUES ($1, $2, $3, $4, $5, $6)", [e.id, e.namespace, e.kind, e.slug, e.name, JSON.stringify(e.data)]);
      }
      for (const a of f.aliases) {
        await pool.query("INSERT INTO e_aliases (id, entity_id, alias) VALUES ($1, $2, $3)", [a.id, a.entityId, a.alias]);
      }
      for (const r of f.relations) {
        await pool.query("INSERT INTO e_relations (id, subject_id, predicate, object_id) VALUES ($1, $2, $3, $4)", [r.id, r.subjectId, r.predicate, r.objectId]);
      }
      for (const c of f.claims) {
        await pool.query("INSERT INTO e_claims (id, entity_id, statement, confidence, source) VALUES ($1, $2, $3, $4, $5)", [c.id, c.entityId, c.statement, c.confidence, c.source]);
      }
      for (const d of f.documents) {
        await pool.query("INSERT INTO e_documents (id, entity_id, content) VALUES ($1, $2, $3)", [d.id, d.entityId, d.content]);
      }
    };

    const teardown = async () => {
      await engine.close();
    };

    return { engine, insertFixtures, teardown };
  });
} else {
  if (process.env.CI) {
    throw new Error("TEST_DATABASE_URL is required in CI but was not set.");
  }
  describe.skip("PostgresEngine", () => {
    test("skipped because TEST_DATABASE_URL is not set", () => {});
  });
}

if (testDbUrl) {
  describe("PostgreSQL alias resolution regression", () => {
    test("deduplicates entities, filters namespaces, orders IDs, and returns no matches", async () => {
      const engine = new PostgresEngine({ connectionString: testDbUrl });
      const pool = (engine as any).pool as Pool;
      const ids = ["alias-reg-z", "alias-reg-a", "alias-reg-other"];

      try {
        const schemaSql = fs.readFileSync(path.join(__dirname, "../schema.sql"), "utf-8");
        await pool.query(schemaSql);
        await pool.query(
          "INSERT INTO e_entities (id, namespace, kind, slug, name, data) VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12), ($13, $14, $15, $16, $17, $18)",
          [
            ids[0], "regression", "node", "z", "Z", "{}",
            ids[1], "regression", "node", "a", "A", "{}",
            ids[2], "other", "node", "other", "Other", "{}",
          ],
        );
        await pool.query(
          "INSERT INTO e_aliases (id, entity_id, alias) VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9), ($10, $11, $12)",
          [
            "alias-reg-z-1", ids[0], "shared",
            "alias-reg-z-2", ids[0], "shared",
            "alias-reg-a", ids[1], "shared",
            "alias-reg-other", ids[2], "shared",
          ],
        );

        const allMatches = await engine.query({ type: "resolve", alias: "shared" });
        expect(allMatches.entities?.map((entity) => entity.id)).toEqual([ids[1], ids[2], ids[0]]);

        const namespaceMatches = await engine.query({
          type: "resolve",
          alias: "shared",
          namespace: "regression",
        });
        expect(namespaceMatches.entities?.map((entity) => entity.id)).toEqual([ids[1], ids[0]]);

        const noMatches = await engine.query({ type: "resolve", alias: "missing" });
        expect(noMatches.entities).toEqual([]);
      } finally {
        await pool.query("DELETE FROM e_aliases WHERE entity_id = ANY($1::varchar[])", [ids]);
        await pool.query("DELETE FROM e_entities WHERE id = ANY($1::varchar[])", [ids]);
        await engine.close();
      }
    });
  });
}
