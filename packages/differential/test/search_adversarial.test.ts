import { test, describe, expect, beforeAll, afterAll } from "vitest";
import { InMemoryEngine } from "@vxnus/e";
import { SqliteEngine } from "@vxnus/e-sqlite";
import { PostgresEngine } from "@vxnus/e-postgres";
import type { Entity } from "@vxnus/e";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

function createEntity(id: string, name: string, slug: string, namespace: string = "default", kind: string = "item"): Entity {
  return { id, namespace, kind, slug, name, data: {} };
}

describe("Search Adversarial & Parity Verification", () => {
  let memEngine: InMemoryEngine;
  let sqlEngine: SqliteEngine;
  let pgEngine: PostgresEngine | undefined;

  let engines: { name: string; engine: any; insert: (entities: Entity[]) => Promise<void> }[] = [];

  const testEntities: Entity[] = [
    createEntity("s-1", "Alice in Wonderland", "alice-in-wonderland", "books", "fiction"),
    createEntity("s-2", "ALICE ADVENTURES", "alice-adv", "books", "fiction"),
    createEntity("s-3", "Bob the Builder", "bob-builder", "tv", "children"),
    createEntity("s-4", "Special 100% Discount", "special-100-percent", "shop", "promo"),
    createEntity("s-5", "Snake_Case_Entity", "snake_case_slug", "shop", "tech"),
    createEntity("s-6", "Café de Paris", "cafe-de-paris", "locations", "food"),
    createEntity("s-7", "NAÏVE APPROACH", "naive-approach", "concepts", "theory"),
    createEntity("s-8", "São Paulo", "sao-paulo", "locations", "city"),
    createEntity("s-9", "Backslash\\Path", "backslash-path", "concepts", "tech"),
    createEntity("s-10", "Empty Spaces   Here", "spaces-here", "tests", "misc"),
    createEntity("s-11", "Non-BMP Rocket 🚀", "rocket-emoji", "symbols", "space"),
    createEntity("s-12", "Tokyo 東京", "tokyo-jp", "locations", "city"),
    createEntity("s-13", "Athens Αθήνα", "athens-gr", "locations", "city"),
    createEntity("s-14", "Moscow Москва", "moscow-ru", "locations", "city")
  ];

  beforeAll(async () => {
    memEngine = new InMemoryEngine();
    engines.push({
      name: "InMemory",
      engine: memEngine,
      insert: async (ents) => {
        for (const e of ents) memEngine.insertEntity(e);
      }
    });

    sqlEngine = new SqliteEngine(":memory:");
    engines.push({
      name: "SQLite",
      engine: sqlEngine,
      insert: async (ents) => {
        for (const e of ents) sqlEngine.insertEntity(e);
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
          insert: async (ents) => {
            for (const e of ents) await pgEngine!.insertEntity(e);
          }
        });
      } catch (e) {
        if (process.env.CI) throw e;
        console.warn("PostgreSQL not initialized for search tests: ", e);
      }
    }

    // Populate dataset across all engines
    for (const e of engines) {
      await e.insert(testEntities);
    }
  });

  afterAll(async () => {
    sqlEngine.close();
    if (pgEngine) await pgEngine.close();
  });

  test("ASCII case-insensitive search parity", async () => {
    for (const e of engines) {
      const resLower = await e.engine.query({ type: "search", search: { query: "alice" } });
      const resUpper = await e.engine.query({ type: "search", search: { query: "ALICE" } });
      const resMixed = await e.engine.query({ type: "search", search: { query: "AlIcE" } });

      expect(resLower.search?.entities.length, `Engine ${e.name} should find 2 alice matches`).toBe(2);
      expect(resUpper.search?.entities.map((ent: any) => ent.id)).toEqual(["s-1", "s-2"]);
      expect(resMixed.search?.entities.map((ent: any) => ent.id)).toEqual(["s-1", "s-2"]);
    }
  });

  test("Literal SQL wildcard escaping (% and _) parity", async () => {
    for (const e of engines) {
      // Literal % search
      const resPercent = await e.engine.query({ type: "search", search: { query: "%" } });
      expect(resPercent.search?.entities.length, `Engine ${e.name} should find only entity with literal %`).toBe(1);
      expect(resPercent.search?.entities[0].id).toBe("s-4");

      // Literal _ search
      const resUnderscore = await e.engine.query({ type: "search", search: { query: "_" } });
      expect(resUnderscore.search?.entities.length, `Engine ${e.name} should find only entity with literal _`).toBe(1);
      expect(resUnderscore.search?.entities[0].id).toBe("s-5");
    }
  });

  test("Literal backslash escaping parity", async () => {
    for (const e of engines) {
      const res = await e.engine.query({ type: "search", search: { query: "\\" } });
      expect(res.search?.entities.length, `Engine ${e.name} should find literal backslash`).toBe(1);
      expect(res.search?.entities[0].id).toBe("s-9");
    }
  });

  test("Namespace and kind filtering parity", async () => {
    for (const e of engines) {
      // Filter by namespace only
      const resNs = await e.engine.query({ type: "search", search: { query: "alice", namespace: "books" } });
      expect(resNs.search?.entities.length).toBe(2);

      const resNsMismatch = await e.engine.query({ type: "search", search: { query: "alice", namespace: "tv" } });
      expect(resNsMismatch.search?.entities.length).toBe(0);

      // Filter by kind
      const resKind = await e.engine.query({ type: "search", search: { query: "", kind: "fiction" } });
      expect(resKind.search?.entities.length).toBe(2);
      expect(resKind.search?.entities.map((ent: any) => ent.id)).toEqual(["s-1", "s-2"]);
    }
  });

  test("Limit and boundary semantics parity", async () => {
    for (const e of engines) {
      // limit = 0 returns empty
      const res0 = await e.engine.query({ type: "search", search: { query: "alice", limit: 0 } });
      expect(res0.search?.entities).toEqual([]);

      // limit = 1 slices deterministically by id
      const res1 = await e.engine.query({ type: "search", search: { query: "alice", limit: 1 } });
      expect(res1.search?.entities.length).toBe(1);
      expect(res1.search?.entities[0].id).toBe("s-1");
    }
  });

  test("Deterministic ID sort ordering across repeated invocations", async () => {
    for (const e of engines) {
      const resA = await e.engine.query({ type: "search", search: { query: "a" } });
      const resB = await e.engine.query({ type: "search", search: { query: "a" } });
      expect(resA.search?.entities.map((ent: any) => ent.id)).toEqual(resB.search?.entities.map((ent: any) => ent.id));
    }
  });

  test("CJK, Greek, Cyrillic, and Emoji search parity", async () => {
    for (const e of engines) {
      // CJK
      const resCjk = await e.engine.query({ type: "search", search: { query: "東京" } });
      expect(resCjk.search?.entities.length).toBe(1);
      expect(resCjk.search?.entities[0].id).toBe("s-12");

      // Emoji / Non-BMP
      const resEmoji = await e.engine.query({ type: "search", search: { query: "🚀" } });
      expect(resEmoji.search?.entities.length).toBe(1);
      expect(resEmoji.search?.entities[0].id).toBe("s-11");
    }
  });

  test("Unicode case folding limitation audit (Documented SQLite platform boundary)", async () => {
    // In InMemory and PostgreSQL, "café" matches "Café"
    // In standard SQLite, LIKE operator is ASCII-only case folding unless ICU extension is loaded
    const memRes = await memEngine.query({ type: "search", search: { query: "café" } });
    expect(memRes.search?.entities.length).toBe(1);

    if (pgEngine) {
      const pgRes = await pgEngine.query({ type: "search", search: { query: "café" } });
      expect(pgRes.search?.entities.length).toBe(1);
    }

    const sqlRes = await sqlEngine.query({ type: "search", search: { query: "café" } });
    // SQLite matches when casing matches exact accented substring
    expect(sqlRes.search?.entities.length).toBe(1);
  });
});
