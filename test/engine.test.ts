import { test, expect, describe } from "vitest";
import { InMemoryEngine } from "../src/engine.js";

describe("E Core Engine", () => {
  test("Teyvat Fixture", async () => {
    const engine = new InMemoryEngine();
    
    engine.insertEntity({
      id: "e-1",
      namespace: "teyvat",
      kind: "character",
      slug: "zhongli",
      name: "Zhongli",
      data: {}
    });
    engine.insertEntity({
      id: "e-2",
      namespace: "teyvat",
      kind: "nation",
      slug: "liyue",
      name: "Liyue",
      data: {}
    });
    engine.insertAlias({
      id: "a-1",
      entityId: "e-1",
      alias: "Rex Lapis"
    });
    engine.insertRelation({
      id: "r-1",
      subjectId: "e-1",
      predicate: "affiliated_with",
      objectId: "e-2"
    });

    const resolveResult = await engine.query({ type: "resolve", alias: "Rex Lapis" });
    expect(resolveResult.entities.length).toBe(1);
    expect(resolveResult.entities[0].id).toBe("e-1");

    const relationResult = await engine.query({ type: "findRelations", subjectId: "e-1" });
    expect(relationResult.relations.length).toBe(1);
    expect(relationResult.relations[0].objectId).toBe("e-2");
    expect(relationResult.entities.length).toBe(2);
    expect(relationResult.entities.find(e => e.id === "e-2")).toBeDefined();
    expect(relationResult.entities.find(e => e.id === "e-1")).toBeDefined();
  });

  test("Software Fixture", async () => {
    const engine = new InMemoryEngine();
    engine.insertEntity({ id: "s-1", namespace: "software", kind: "service", slug: "api", name: "API", data: {} });
    engine.insertEntity({ id: "s-2", namespace: "software", kind: "database", slug: "postgres", name: "PostgreSQL", data: {} });
    engine.insertRelation({ id: "r-2", subjectId: "s-1", predicate: "depends_on", objectId: "s-2" });

    const result = await engine.query({ type: "findRelations", subjectId: "s-1" });
    expect(result.relations.length).toBe(1);
    expect(result.entities.find(e => e.id === "s-2")).toBeDefined();
  });

  test("Schale Fixture", async () => {
    const engine = new InMemoryEngine();
    engine.insertEntity({ id: "sh-1", namespace: "schale", kind: "student", slug: "shiroko", name: "Shiroko", data: {} });
    engine.insertEntity({ id: "sh-2", namespace: "schale", kind: "academy", slug: "abydos", name: "Abydos", data: {} });
    engine.insertRelation({ id: "r-3", subjectId: "sh-1", predicate: "enrolled_in", objectId: "sh-2" });

    const result = await engine.query({ type: "findRelations", subjectId: "sh-1" });
    expect(result.relations.length).toBe(1);
    expect(result.entities.find(e => e.id === "sh-2")?.name).toBe("Abydos");
  });

  test("Reverse Relation and Hydration Guarantees", async () => {
    const engine = new InMemoryEngine();
    engine.insertEntity({ id: "e-1", namespace: "test", kind: "node", slug: "a", name: "A", data: {} });
    engine.insertEntity({ id: "e-2", namespace: "test", kind: "node", slug: "b", name: "B", data: {} });
    engine.insertEntity({ id: "e-3", namespace: "test", kind: "node", slug: "c", name: "C", data: {} });
    engine.insertRelation({ id: "r-1", subjectId: "e-1", predicate: "links_to", objectId: "e-2" });
    engine.insertRelation({ id: "r-2", subjectId: "e-3", predicate: "links_to", objectId: "e-2" });

    // Query by objectId (reverse relation)
    const reverseResult = await engine.query({ type: "findRelations", objectId: "e-2" });
    expect(reverseResult.relations.length).toBe(2);
    // Both subject and object should be hydrated
    const hydratedIds = reverseResult.entities.map(e => e.id);
    expect(hydratedIds).toContain("e-1");
    expect(hydratedIds).toContain("e-2");
    expect(hydratedIds).toContain("e-3");

    // Query by subjectId and objectId
    const exactResult = await engine.query({ type: "findRelations", subjectId: "e-1", objectId: "e-2" });
    expect(exactResult.relations.length).toBe(1);
    expect(exactResult.relations[0].id).toBe("r-1");

    // Empty result behavior
    const emptyResult = await engine.query({ type: "findRelations", subjectId: "e-1", objectId: "e-3" });
    expect(emptyResult.relations.length).toBe(0);
    expect(emptyResult.entities.length).toBe(0);
  });
});
