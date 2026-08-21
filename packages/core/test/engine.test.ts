import { test, expect, describe } from "vitest";
import { InMemoryEngine } from "../src/engine.js";
import { runBehavioralTests, type Fixtures } from "./behavior.js";

runBehavioralTests("InMemoryEngine", async () => {
  const engine = new InMemoryEngine();
  
  const insertFixtures = async (f: Fixtures) => {
    f.entities.forEach(e => engine.insertEntity(e));
    f.aliases.forEach(a => engine.insertAlias(a));
    f.relations.forEach(r => engine.insertRelation(r));
    f.claims.forEach(c => engine.insertClaim(c));
    f.documents.forEach(d => engine.insertDocument(d));
  };

  const teardown = async () => {};

  return { engine, insertFixtures, teardown };
});

describe("InMemoryEngine Contract Tests", () => {
  test("findRelations throws if neither subjectId nor objectId is provided", async () => {
    const engine = new InMemoryEngine();
    await expect(engine.query({ type: "findRelations" } as any)).rejects.toThrow("findRelations requires at least subjectId or objectId");
  });

  test("unknown query type throws", async () => {
    const engine = new InMemoryEngine();
    await expect(engine.query({ type: "unknown" } as any)).rejects.toThrow("Unknown query type: unknown");
  });

  test("search with limit = 0 returns empty", async () => {
    const engine = new InMemoryEngine();
    engine.insertEntity({ id: "1", namespace: "ns", kind: "test", slug: "test", name: "test", data: {} });
    const result = await engine.query({ type: "search", search: { query: "test", limit: 0 } });
    expect(result.search!.entities).toHaveLength(0);
  });

  test("findClaims and findDocuments do not hydrate entities", async () => {
    const engine = new InMemoryEngine();
    engine.insertEntity({ id: "1", namespace: "ns", kind: "test", slug: "test", name: "test", data: {} });
    engine.insertClaim({ id: "c1", entityId: "1", statement: "claim", confidence: "canon", source: "src" });
    engine.insertDocument({ id: "d1", entityId: "1", content: "doc" });

    const claimRes = await engine.query({ type: "findClaims", entityId: "1" });
    expect(claimRes.claims!).toHaveLength(1);
    expect(claimRes.entities!).toHaveLength(0);

    const docRes = await engine.query({ type: "findDocuments", entityId: "1" });
    expect(docRes.documents!).toHaveLength(1);
    expect(docRes.entities!).toHaveLength(0);
  });
});
