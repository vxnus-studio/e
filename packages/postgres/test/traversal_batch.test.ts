import { describe, expect, test } from "vitest";
import { PostgresEngine } from "../src/index.js";

describe("PostgreSQL traversal query shape", () => {
  test("expands a frontier with one set-based relation query", async () => {
    const calls: Array<{ text: string; params: unknown[] }> = [];
    const fakePool = {
      query: async (text: string, params: unknown[] = []) => {
        calls.push({ text, params });

        if (text.includes("WHERE id = $1")) {
          return {
            rows: [{
              id: "root",
              namespace: "test",
              kind: "node",
              slug: "root",
              name: "Root",
              data: {},
            }],
          };
        }
        if (text.includes("WITH frontier(entity_id, budget)")) {
          return {
            rows: [{
              id: "rel-1",
              subject_id: "root",
              predicate: "connects",
              object_id: "leaf",
              dir: "out",
              available_count: 1,
              budget: 100000,
            }],
          };
        }
        if (text.includes("WHERE id = ANY($1)")) {
          return {
            rows: [{
              id: "leaf",
              namespace: "test",
              kind: "node",
              slug: "leaf",
              name: "Leaf",
              data: {},
            }],
          };
        }
        throw new Error(`unexpected query: ${text}`);
      },
      end: async () => undefined,
      removeListener: () => undefined,
    };

    const engine = new PostgresEngine({ connectionString: "postgresql://unused" });
    (engine as any).pool = fakePool;

    const result = await engine.query({
      type: "traverse",
      startId: "root",
      maxDepth: 1,
      maxPaths: 10,
    });

    const relationQueries = calls.filter(({ text }) => text.includes("e_relations"));
    expect(relationQueries).toHaveLength(1);
    expect(relationQueries[0]?.text).toContain("subject_id = f.entity_id");
    expect(relationQueries[0]?.params[0]).toEqual(["root"]);
    expect(result.traversal?.paths).toEqual([{
      startId: "root",
      endId: "leaf",
      edges: [{
        relationId: "rel-1",
        sourceId: "root",
        targetId: "leaf",
        predicate: "connects",
        direction: "out",
      }],
      depth: 1,
    }]);

    await engine.close();
  });
});
