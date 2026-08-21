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

      // 9. Search Limits & Deterministic Behavior
      const searchLimit = await engine.query({ type: "search", query: "acme", limit: 1 });
      expect(searchLimit.entities.length).toBe(1);

      // 10. Missing Entities
      const missingRes = await engine.query({ type: "getEntity", id: "missing" });
      expect(missingRes.entities.length).toBe(0);

      // 11. Unsupported Traversal & Warnings
      const traverseRes = await engine.query({ type: "traverse", startId: "e-1" } as any);
      expect(traverseRes.metadata.warnings?.length).toBeGreaterThan(0);

      await teardownFn();
    });
  });
}
