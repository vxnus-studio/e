import { test, expect, describe } from "vitest";
import type { EQueryEngine, Entity, Relation, Claim, Document } from "../src/types.js";

export interface Fixtures {
  entities: Entity[];
  aliases: { id: string; entityId: string; alias: string }[];
  relations: Relation[];
  claims: Claim[];
  documents: Document[];
}

export function runBehavioralTests(
  name: string,
  setup: () => Promise<{ engine: EQueryEngine; insertFixtures: (f: Fixtures) => Promise<void>; teardown: () => Promise<void> }>
) {
  describe(`${name} Behavioral Parity`, () => {
    let engine: EQueryEngine;
    let teardownFn: () => Promise<void>;

    test("Setup and Run All Behaviors", async () => {
      const { engine: e, insertFixtures, teardown } = await setup();
      engine = e;
      teardownFn = teardown;

      await insertFixtures({
        entities: [
          { id: "e-1", namespace: "corporate", kind: "person", slug: "jane-doe", name: "Jane Doe", data: {} },
          { id: "e-2", namespace: "corporate", kind: "company", slug: "acme-corp", name: "Acme Corporation", data: {} },
          { id: "e-3", namespace: "fiction", kind: "company", slug: "acme-corp", name: "Acme Looney", data: {} },
        ],
        aliases: [
          { id: "a-1", entityId: "e-1", alias: "J.D." },
        ],
        relations: [
          { id: "r-1", subjectId: "e-1", predicate: "works_at", objectId: "e-2" },
        ],
        claims: [
          { id: "c-1", entityId: "e-1", statement: "CEO of Acme", confidence: "canon", source: "Wiki" },
        ],
        documents: [
          { id: "d-1", entityId: "e-1", content: "Jane Doe's profile document." },
        ]
      });

      // 1. Entity Lookup
      const getRes = await engine.query({ type: "getEntity", id: "e-1" });
      expect(getRes.entities.length).toBe(1);
      expect(getRes.entities[0].name).toBe("Jane Doe");

      // 2. Aliases & Namespaces
      const resolveRes = await engine.query({ type: "resolve", alias: "J.D.", namespace: "corporate" });
      expect(resolveRes.entities.length).toBe(1);
      expect(resolveRes.entities[0].id).toBe("e-1");

      // 2.5 Alias Collision Across Namespaces
      await insertFixtures({
        entities: [
          { id: "e-foo-A", namespace: "A", kind: "test", slug: "foo-a", name: "Foo A", data: {} },
          { id: "e-foo-B", namespace: "B", kind: "test", slug: "foo-b", name: "Foo B", data: {} },
        ],
        aliases: [
          { id: "a-foo-1", entityId: "e-foo-A", alias: "foo" },
          { id: "a-foo-2", entityId: "e-foo-B", alias: "foo" },
        ],
        relations: [], claims: [], documents: []
      });
      const resolveFoo = await engine.query({ type: "resolve", alias: "foo" });
      const fooIds = resolveFoo.entities.map(e => e.id).sort();
      expect(fooIds.length).toBe(2);
      expect(fooIds).toEqual(["e-foo-A", "e-foo-B"]);

      // 3. Forward Relations
      const fwdRes = await engine.query({ type: "findRelations", subjectId: "e-1" });
      expect(fwdRes.relations.length).toBe(1);
      const hydratedIds = fwdRes.entities.map(ent => ent.id);
      expect(hydratedIds).toContain("e-1");
      expect(hydratedIds).toContain("e-2");

      // 4. Reverse Relations
      const revRes = await engine.query({ type: "findRelations", objectId: "e-2" });
      expect(revRes.relations.length).toBe(1);
      expect(revRes.relations[0].subjectId).toBe("e-1");

      // 5. Exact Relation Filtering
      const exactRes = await engine.query({ type: "findRelations", subjectId: "e-1", objectId: "e-2", predicate: "works_at" });
      expect(exactRes.relations.length).toBe(1);

      // 6. Claims
      const claimsRes = await engine.query({ type: "findClaims", entityId: "e-1" });
      expect(claimsRes.claims.length).toBe(1);

      // 7. Documents
      const docsRes = await engine.query({ type: "findDocuments", entityId: "e-1" });
      expect(docsRes.documents.length).toBe(1);

      // 8. Search (Case-insensitive)
      const searchRes = await engine.query({ type: "search", query: "jane" });
      expect(searchRes.entities.length).toBe(1);
      expect(searchRes.entities[0].id).toBe("e-1");

      // 10. Search Limits & Deterministic Behavior
      const searchLimit0 = await engine.query({ type: "search", query: "acme", limit: 0 });
      expect(searchLimit0.entities.length).toBe(0);

      const searchLimitNeg = await engine.query({ type: "search", query: "acme", limit: -5 });
      expect(searchLimitNeg.entities.length).toBe(0);

      const searchLimitOmitted = await engine.query({ type: "search", query: "acme" });
      expect(searchLimitOmitted.entities.length).toBe(2);

      const searchLimit1 = await engine.query({ type: "search", query: "acme", limit: 1 });
      expect(searchLimit1.entities.length).toBe(1);
      expect(searchLimit1.entities[0].id).toBe("e-2");

      // 10.5 Deterministic Binary Ordering
      await insertFixtures({
        entities: [
          { id: "A-1", namespace: "order", kind: "test", slug: "order", name: "order", data: {} },
          { id: "A1", namespace: "order", kind: "test", slug: "order", name: "order", data: {} },
          { id: "A_1", namespace: "order", kind: "test", slug: "order", name: "order", data: {} },
          { id: "a-1", namespace: "order", kind: "test", slug: "order", name: "order", data: {} },
          { id: "a1", namespace: "order", kind: "test", slug: "order", name: "order", data: {} },
          { id: "a_1", namespace: "order", kind: "test", slug: "order", name: "order", data: {} },
        ],
        aliases: [], relations: [], claims: [], documents: []
      });
      const orderSearch = await engine.query({ type: "search", query: "order", namespace: "order" });
      const orderIds = orderSearch.entities.map(e => e.id);
      expect(orderIds).toEqual(["A-1", "A1", "A_1", "a-1", "a1", "a_1"]);

      // 11. Escaping % and _
      await insertFixtures({
        entities: [
          { id: "e-pct", namespace: "test", kind: "test", slug: "100%", name: "100%", data: {} },
          { id: "e-us", namespace: "test", kind: "test", slug: "a_b", name: "a_b", data: {} },
        ],
        aliases: [], relations: [], claims: [], documents: []
      });
      const pctSearch = await engine.query({ type: "search", query: "%" });
      expect(pctSearch.entities.map(e => e.id)).toContain("e-pct");
      expect(pctSearch.entities.map(e => e.id)).not.toContain("e-1"); // Should not match everything

      const usSearch = await engine.query({ type: "search", query: "_" });
      expect(usSearch.entities.map(e => e.id)).toContain("e-us");
      expect(usSearch.entities.map(e => e.id)).not.toContain("e-1"); // Should not match everything

      // 12. Missing Entities
      const missingRes = await engine.query({ type: "getEntity", id: "missing" });
      expect(missingRes.entities.length).toBe(0);

      // 13. Empty query
      const emptyQuery = await engine.query({ type: "search", query: "" });
      expect(emptyQuery.entities.length).toBeGreaterThan(0); // Should match everything, restricted by whatever is in db
      
      // 14. Traversal
      await insertFixtures({
        entities: [
          { id: "T-A", namespace: "traverse", kind: "node", slug: "ta", name: "TA", data: {} },
          { id: "T-B", namespace: "traverse", kind: "node", slug: "tb", name: "TB", data: {} },
          { id: "T-C", namespace: "traverse", kind: "node", slug: "tc", name: "TC", data: {} },
          { id: "T-D", namespace: "traverse", kind: "node", slug: "td", name: "TD", data: {} },
          { id: "T-E", namespace: "traverse", kind: "node", slug: "te", name: "TE", data: {} },
        ],
        aliases: [],
        relations: [
          { id: "tr1", subjectId: "T-A", predicate: "knows", objectId: "T-B" },
          { id: "tr2", subjectId: "T-A", predicate: "likes", objectId: "T-C" },
          { id: "tr3", subjectId: "T-B", predicate: "knows", objectId: "T-D" },
          { id: "tr4", subjectId: "T-C", predicate: "knows", objectId: "T-D" }, // convergence
          { id: "tr5", subjectId: "T-C", predicate: "knows", objectId: "T-E" },
          { id: "tr6", subjectId: "T-D", predicate: "knows", objectId: "T-A" }, // cycle
        ],
        claims: [], documents: []
      });

      const travDepth0 = await engine.query({ type: "traverse", startId: "T-A", maxDepth: 0 });
      expect(travDepth0.entities.map(e => e.id)).toEqual(["T-A"]);

      const travDepth1 = await engine.query({ type: "traverse", startId: "T-A", maxDepth: 1 });
      expect(travDepth1.entities.map(e => e.id)).toEqual(["T-A", "T-B", "T-C"]);

      const travDepth2 = await engine.query({ type: "traverse", startId: "T-A", maxDepth: 2 });
      expect(travDepth2.entities.map(e => e.id)).toEqual(["T-A", "T-B", "T-C", "T-D", "T-E"]);

      const travMissing = await engine.query({ type: "traverse", startId: "MISSING", maxDepth: 1 });
      expect(travMissing.entities.length).toBe(0);

      const travPredicate = await engine.query({ type: "traverse", startId: "T-A", maxDepth: 2, predicates: ["likes"] });
      expect(travPredicate.entities.map(e => e.id)).toEqual(["T-A", "T-C"]);

      const travEmptyPred = await engine.query({ type: "traverse", startId: "T-A", maxDepth: 2, predicates: ["unknown_pred"] });
      expect(travEmptyPred.entities.map(e => e.id)).toEqual(["T-A"]);

      
      // 15. Invalid findRelations (neither subjectId nor objectId)
      await expect(engine.query({ type: "findRelations" } as any)).rejects.toThrow(/requires at least subjectId or objectId/);

      // 16. Unknown query type
      await expect(engine.query({ type: "unknown" } as any)).rejects.toThrow(/Unknown query type/);

      await teardownFn();
    });
  });
}
