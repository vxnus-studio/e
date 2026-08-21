import { test, expect, describe, beforeAll, afterAll } from "vitest";
import { InMemoryEngine } from "../../core/src/engine.js";
import { SqliteEngine } from "../../sqlite/src/index.js";
import { PostgresEngine } from "../../postgres/src/index.js";
import { UnsupportedOperationError } from "../../core/src/errors.js";

describe("Capabilities Hostile Test", () => {
  let engines: { name: string; engine: any }[] = [];

  beforeAll(() => {
    engines.push({ name: "InMemory", engine: new InMemoryEngine() });
    try {
      engines.push({ name: "SQLite", engine: new SqliteEngine(":memory:") });
    } catch(e) {}
    
    if (process.env.TEST_DATABASE_URL) {
      engines.push({ name: "PostgreSQL", engine: new PostgresEngine({ connectionString: process.env.TEST_DATABASE_URL }) });
    }
  });

  afterAll(async () => {
    for (const e of engines) if (e.engine.close) await e.engine.close();
  });

  test("Capabilities describe actual behavior", async () => {
    for (const e of engines) {
      const caps = (await e.engine.query({ type: "getCapabilities" })).capabilities;
      expect(caps).toBeDefined();

      if (caps!.semanticSearch === false) {
        try { await e.engine.query({ type: "search", search: { query: "test", mode: "semantic" } }); expect.fail("Should throw"); } catch(e: any) { expect(e.name).toBe("UnsupportedOperationError"); }
      }
      if (caps!.hybridSearch === false) {
        try { await e.engine.query({ type: "search", search: { query: "test", mode: "hybrid" } }); expect.fail("Should throw"); } catch(e: any) { expect(e.name).toBe("UnsupportedOperationError"); }
      }
      // If advertised true, it should return a result (even if empty), not an UnsupportedOperationError.
      if (caps!.lexicalSearch === true) {
        const res = await e.engine.query({ type: "search", search: { query: "test", mode: "lexical" } });
        expect(res.search).toBeDefined();
      }
    }
  });
});
