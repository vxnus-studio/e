import { test, expect, describe, beforeAll, afterAll } from "vitest";
import { InMemoryEngine } from "../../core/src/engine.js";
import { SqliteEngine } from "../../sqlite/src/index.js";
import { PostgresEngine } from "../../postgres/src/index.js";

describe("Capabilities Contract Truth Verification", () => {
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

  test("All engines report exact same capability matrix", async () => {
    const capsList = [];
    for (const e of engines) {
      const res = await e.engine.query({ type: "getCapabilities" });
      expect(res.capabilities).toBeDefined();
      capsList.push({ name: e.name, caps: res.capabilities });
    }

    const baseline = capsList[0].caps;
    for (let i = 1; i < capsList.length; i++) {
      expect(capsList[i].caps, `Engine ${capsList[i].name} capability mismatch`).toEqual(baseline);
    }
  });

  test("Unsupported capabilities strictly throw UnsupportedOperationError", async () => {
    for (const e of engines) {
      const caps = (await e.engine.query({ type: "getCapabilities" })).capabilities!;

      // semanticSearch: false -> search mode 'semantic' must throw UnsupportedOperationError
      if (caps.semanticSearch === false) {
        try {
          await e.engine.query({ type: "search", search: { query: "test", mode: "semantic" } });
          expect.fail(`Engine ${e.name} should have thrown on unsupported mode 'semantic'`);
        } catch (err: any) {
          expect(err.name).toBe("UnsupportedOperationError");
        }
      }

      // hybridSearch: false -> search mode 'hybrid' must throw UnsupportedOperationError
      if (caps.hybridSearch === false) {
        try {
          await e.engine.query({ type: "search", search: { query: "test", mode: "hybrid" } });
          expect.fail(`Engine ${e.name} should have thrown on unsupported mode 'hybrid'`);
        } catch (err: any) {
          expect(err.name).toBe("UnsupportedOperationError");
        }
      }
    }
  });

  test("Supported capabilities execute without UnsupportedOperationError", async () => {
    for (const e of engines) {
      const caps = (await e.engine.query({ type: "getCapabilities" })).capabilities!;

      if (caps.exactResolution) {
        const res = await e.engine.query({ type: "resolve", alias: "nonexistent" });
        expect(res.entities).toBeDefined();
      }

      if (caps.lexicalSearch) {
        const res = await e.engine.query({ type: "search", search: { query: "test", mode: "lexical" } });
        expect(res.search).toBeDefined();
      }

      if (caps.traversal) {
        const res = await e.engine.query({ type: "traverse", startId: "nonexistent" });
        expect(res.traversal).toBeDefined();
      }
    }
  });
});
