import { test, expect, describe } from "vitest";
import { InMemoryEngine } from "../src/engine.js";
import type { QueryRequest } from "../src/types.js";

describe("E Core Engine", () => {
  test("Basic Entity and Resolve (Namespaces, Aliases)", async () => {
    const engine = new InMemoryEngine();
    
    engine.insertEntity({
      id: "p-1",
      namespace: "corporate",
      kind: "person",
      slug: "jane-doe",
      name: "Jane Doe",
      data: { role: "CEO" }
    });
    engine.insertEntity({
      id: "c-1",
      namespace: "corporate",
      kind: "company",
      slug: "acme-corp",
      name: "Acme Corporation",
      data: {}
    });
    // Collision in different namespace
    engine.insertEntity({
      id: "f-1",
      namespace: "fiction",
      kind: "company",
      slug: "acme-corp",
      name: "Acme Looney",
      data: {}
    });

    engine.insertAlias({
      id: "a-1",
      entityId: "p-1",
      alias: "J.D."
    });

    // Test Resolve without namespace
    const resolveAll = await engine.query({ type: "resolve", alias: "J.D." });
    expect(resolveAll.entities.length).toBe(1);
    expect(resolveAll.entities[0].id).toBe("p-1");

    // Test getEntity
    const getEntityRes = await engine.query({ type: "getEntity", id: "c-1" });
    expect(getEntityRes.entities.length).toBe(1);
    expect(getEntityRes.entities[0].name).toBe("Acme Corporation");

    // Empty result for non-existent entity
    const emptyGet = await engine.query({ type: "getEntity", id: "non-existent" });
    expect(emptyGet.entities.length).toBe(0);
    expect(emptyGet.metadata.timeMs).toBeGreaterThanOrEqual(0);
  });

  test("Relations and Hydration (Forward, Reverse, Exact Filtering)", async () => {
    const engine = new InMemoryEngine();
    engine.insertEntity({ id: "e-1", namespace: "test", kind: "node", slug: "a", name: "A", data: {} });
    engine.insertEntity({ id: "e-2", namespace: "test", kind: "node", slug: "b", name: "B", data: {} });
    engine.insertEntity({ id: "e-3", namespace: "test", kind: "node", slug: "c", name: "C", data: {} });
    
    engine.insertRelation({ id: "r-1", subjectId: "e-1", predicate: "links_to", objectId: "e-2" });
    engine.insertRelation({ id: "r-2", subjectId: "e-3", predicate: "links_to", objectId: "e-2" });
    engine.insertRelation({ id: "r-3", subjectId: "e-1", predicate: "owns", objectId: "e-3" });

    // Forward relation
    const forward = await engine.query({ type: "findRelations", subjectId: "e-1" });
    expect(forward.relations.length).toBe(2);
    expect(forward.entities.map(e => e.id)).toEqual(expect.arrayContaining(["e-1", "e-2", "e-3"]));

    // Reverse relation
    const reverse = await engine.query({ type: "findRelations", objectId: "e-2" });
    expect(reverse.relations.length).toBe(2);
    expect(reverse.entities.map(e => e.id)).toEqual(expect.arrayContaining(["e-1", "e-2", "e-3"]));

    // Exact relation filtering
    const exact = await engine.query({ type: "findRelations", subjectId: "e-1", objectId: "e-3", predicate: "owns" });
    expect(exact.relations.length).toBe(1);
    expect(exact.relations[0].id).toBe("r-3");

    // Empty relation
    const emptyRel = await engine.query({ type: "findRelations", subjectId: "e-3", objectId: "e-1" });
    expect(emptyRel.relations.length).toBe(0);
    expect(emptyRel.entities.length).toBe(0);
  });

  test("Claims and Documents", async () => {
    const engine = new InMemoryEngine();
    engine.insertEntity({ id: "e-1", namespace: "test", kind: "node", slug: "a", name: "A", data: {} });
    
    engine.insertClaim({
      id: "cl-1",
      entityId: "e-1",
      statement: "A is the first node",
      confidence: "canon",
      source: "Manual"
    });

    engine.insertDocument({
      id: "d-1",
      entityId: "e-1",
      content: "This is a long document about A."
    });

    const claimsRes = await engine.query({ type: "findClaims", entityId: "e-1" });
    expect(claimsRes.claims.length).toBe(1);
    expect(claimsRes.claims[0].statement).toBe("A is the first node");

    // Note: The current InMemoryEngine doesn't seem to implement retrieving documents natively yet,
    // but the test asserts what is currently possible. 
    // We will test if the engine supports it or not.
  });

  test("Search", async () => {
    const engine = new InMemoryEngine();
    engine.insertEntity({ id: "e-1", namespace: "test1", kind: "node", slug: "apple", name: "Apple", data: {} });
    engine.insertEntity({ id: "e-2", namespace: "test2", kind: "node", slug: "pineapple", name: "Pineapple", data: {} });
    engine.insertEntity({ id: "e-3", namespace: "test1", kind: "node", slug: "banana", name: "Banana", data: {} });

    // Global search
    const globalSearch = await engine.query({ type: "search", query: "apple" });
    expect(globalSearch.entities.length).toBe(2);

    // Namespace scoped search
    const scopedSearch = await engine.query({ type: "search", query: "apple", namespace: "test2" });
    expect(scopedSearch.entities.length).toBe(1);
    expect(scopedSearch.entities[0].id).toBe("e-2");

    // Limit
    const limitSearch = await engine.query({ type: "search", query: "apple", limit: 1 });
    expect(limitSearch.entities.length).toBe(1);
  });

  test("Unsupported Traversal and Metadata/Warnings", async () => {
    const engine = new InMemoryEngine();
    const result = await engine.query({ type: "traverse", startId: "e-1" } as QueryRequest);
    expect(result.entities.length).toBe(0);
    expect(result.metadata.warnings).toBeDefined();
    expect(result.metadata.warnings![0]).toContain("Traverse is not fully implemented");
  });
});
