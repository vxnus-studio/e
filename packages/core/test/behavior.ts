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
      expect(getRes.entities!.length).toBe(1);
      expect(getRes.entities![0].name).toBe("Jane Doe");

      // 2. Aliases & Namespaces
      const resolveRes = await engine.query({ type: "resolve", alias: "J.D.", namespace: "corporate" });
      expect(resolveRes.entities!.length).toBe(1);
      expect(resolveRes.entities![0].id).toBe("e-1");

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
      const fooIds = resolveFoo.entities!.map(e => e.id).sort();
      expect(fooIds.length).toBe(2);
      expect(fooIds).toEqual(["e-foo-A", "e-foo-B"]);

      // 3. Forward Relations
      const fwdRes = await engine.query({ type: "findRelations", subjectId: "e-1" });
      expect(fwdRes.relations!.length).toBe(1);
      const hydratedIds = fwdRes.entities!.map(ent => ent.id);
      expect(hydratedIds).toContain("e-1");
      expect(hydratedIds).toContain("e-2");

      // 4. Reverse Relations
      const revRes = await engine.query({ type: "findRelations", objectId: "e-2" });
      expect(revRes.relations!.length).toBe(1);
      expect(revRes.relations![0].subjectId).toBe("e-1");

      // 5. Exact Relation Filtering
      const exactRes = await engine.query({ type: "findRelations", subjectId: "e-1", objectId: "e-2", predicate: "works_at" });
      expect(exactRes.relations!.length).toBe(1);

      // 6. Claims
      const claimsRes = await engine.query({ type: "findClaims", entityId: "e-1" });
      expect(claimsRes.claims!.length).toBe(1);

      // 7. Documents
      const docsRes = await engine.query({ type: "findDocuments", entityId: "e-1" });
      expect(docsRes.documents!.length).toBe(1);

      // 8. Search (Case-insensitive)
      const searchRes = await engine.query({ type: "search", search: { query: "jane" } });
      expect(searchRes.search!.entities.length).toBe(1);
      expect(searchRes.search!.entities[0].id).toBe("e-1");

      // 10. Search Limits & Deterministic Behavior
      const searchLimit0 = await engine.query({ type: "search", search: { query: "acme", limit: 0 } });
      expect(searchLimit0.search!.entities.length).toBe(0);

      const searchLimitNeg = await engine.query({ type: "search", search: { query: "acme", limit: -5 } });
      expect(searchLimitNeg.search!.entities.length).toBe(0);

      const searchLimitOmitted = await engine.query({ type: "search", search: { query: "acme" } });
      expect(searchLimitOmitted.search!.entities.length).toBe(2);

      const searchLimit1 = await engine.query({ type: "search", search: { query: "acme", limit: 1 } });
      expect(searchLimit1.search!.entities.length).toBe(1);
      expect(searchLimit1.search!.entities[0].id).toBe("e-2");

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
      const orderSearch = await engine.query({ type: "search", search: { query: "order", namespace: "order" } });
      const orderIds = orderSearch.search!.entities.map(e => e.id);
      expect(orderIds).toEqual(["A-1", "A1", "A_1", "a-1", "a1", "a_1"]);

      // 11. Escaping % and _
      await insertFixtures({
        entities: [
          { id: "e-pct", namespace: "test", kind: "test", slug: "100%", name: "100%", data: {} },
          { id: "e-us", namespace: "test", kind: "test", slug: "a_b", name: "a_b", data: {} },
        ],
        aliases: [], relations: [], claims: [], documents: []
      });
      const pctSearch = await engine.query({ type: "search", search: { query: "%" } });
      expect(pctSearch.search!.entities.map(e => e.id)).toContain("e-pct");
      expect(pctSearch.search!.entities.map(e => e.id)).not.toContain("e-1"); // Should not match everything

      const usSearch = await engine.query({ type: "search", search: { query: "_" } });
      expect(usSearch.search!.entities.map(e => e.id)).toContain("e-us");
      expect(usSearch.search!.entities.map(e => e.id)).not.toContain("e-1"); // Should not match everything

      // 12. Missing Entities
      const missingRes = await engine.query({ type: "getEntity", id: "missing" });
      expect(missingRes.entities!.length).toBe(0);
      expect(missingRes.metadata.warnings).toBeUndefined();

      // 13. Empty query
      const emptyQuery = await engine.query({ type: "search", search: { query: "" } });
      expect(emptyQuery.search!.entities.length).toBeGreaterThan(0); // Should match everything, restricted by whatever is in db

      
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
      expect(travDepth0.traversal!.entities.map(e => e.id)).toEqual(["T-A"]);

      const travDepth1 = await engine.query({ type: "traverse", startId: "T-A", maxDepth: 1 });
      expect(travDepth1.traversal!.entities.map(e => e.id).sort()).toEqual(["T-A", "T-B", "T-C"].sort());

      const travDepth2 = await engine.query({ type: "traverse", startId: "T-A", maxDepth: 2 });
      expect(travDepth2.traversal!.entities.map(e => e.id).sort()).toEqual(["T-A", "T-B", "T-C", "T-D", "T-E"].sort());

      const travMissing = await engine.query({ type: "traverse", startId: "MISSING", maxDepth: 1 });
      expect(travMissing.traversal!.entities.length).toBe(0);

      const travPredicate = await engine.query({ type: "traverse", startId: "T-A", maxDepth: 2, predicates: ["likes"] });
      expect(travPredicate.traversal!.entities.map(e => e.id).sort()).toEqual(["T-A", "T-C"].sort());

      const travEmptyPred = await engine.query({ type: "traverse", startId: "T-A", maxDepth: 2, predicates: ["unknown_pred"] });
      expect(travEmptyPred.traversal!.entities.map(e => e.id)).toEqual(["T-A"]);

      // New Traversal Graph (Weapon -> Material <- Domain -> Region)
      await insertFixtures({
        entities: [
          { id: "W", namespace: "game", kind: "Weapon", slug: "weapon", name: "Weapon", data: {} },
          { id: "M", namespace: "game", kind: "Material", slug: "material", name: "Material", data: {} },
          { id: "D", namespace: "game", kind: "Domain", slug: "domain", name: "Domain", data: {} },
          { id: "R", namespace: "game", kind: "Region", slug: "region", name: "Region", data: {} },
        ],
        aliases: [],
        relations: [
          { id: "r_w_m", subjectId: "W", predicate: "requires", objectId: "M" },
          { id: "r_d_m", subjectId: "D", predicate: "rewards", objectId: "M" },
          { id: "r_d_r", subjectId: "D", predicate: "located_in", objectId: "R" },
        ],
        claims: [], documents: []
      });

      // 1. Bidirectional Traversal from M
      const mTrav = await engine.query({
        type: "traverse",
        startId: "M",
        steps: [
          { direction: "in" }, // Step 1: go backwards to find who requires or rewards M
          { direction: "out" } // Step 2: from those, go out (e.g. D -> R, W has no out)
        ],
        maxDepth: 2
      });
      
      const mEnts = mTrav.traversal!.entities.map(e => e.id).sort();
      expect(mEnts).toEqual(["D", "M", "R", "W"]);
      
      const mPaths = mTrav.traversal!.paths;
      expect(mPaths.length).toBeGreaterThan(0);
      // Path to R: M <-(rewards)- D -(located_in)-> R
      const pathToR = mPaths.find(p => p.endId === "R");
      expect(pathToR).toBeDefined();
      expect(pathToR!.edges.length).toBe(2);
      expect(pathToR!.edges[0].predicate).toBe("rewards");
      expect(pathToR!.edges[0].direction).toBe("in");
      expect(pathToR!.edges[1].predicate).toBe("located_in");
      expect(pathToR!.edges[1].direction).toBe("out");
      
      const capabilities = await engine.query({ type: "getCapabilities" });
      expect(capabilities.capabilities).toBeDefined();
      expect(capabilities.capabilities!.traversal).toBe(true);

      // 15. Invalid findRelations (neither subjectId nor objectId)
      await expect(engine.query({ type: "findRelations" } as any)).rejects.toThrow(/requires at least subjectId or objectId/);

      // 16. Unknown query type
      await expect(engine.query({ type: "unknown" } as any)).rejects.toThrow(/Unknown query type/);

      // Phase 1 tests: Alias Deduplication
      await insertFixtures({
        entities: [
          { id: "e-alias-test", namespace: "alias", kind: "test", slug: "alias-test", name: "Alias Test", data: {} }
        ],
        aliases: [
          { id: "a1", entityId: "e-alias-test", alias: "duplicate-alias" },
          { id: "a2", entityId: "e-alias-test", alias: "duplicate-alias" }
        ],
        relations: [], claims: [], documents: []
      });
      const aliasRes = await engine.query({ type: "resolve", alias: "duplicate-alias" });
      expect(aliasRes.entities!.length).toBe(1);
      expect(aliasRes.entities![0].id).toBe("e-alias-test");

      // Phase 1 tests: Unsupported Search Modes
      await expect(engine.query({ type: "search", search: { query: "test", mode: "semantic" } })).rejects.toThrow(/not supported/);
      await expect(engine.query({ type: "search", search: { query: "test", mode: "hybrid" } })).rejects.toThrow(/not supported/);
      const lexSearch = await engine.query({ type: "search", search: { query: "test", mode: "lexical" } });
      expect(lexSearch.search).toBeDefined();

      // Phase 1 tests: Claim Confidence
      await insertFixtures({
        entities: [
          { id: "e-claim-test", namespace: "claim", kind: "test", slug: "claim-test", name: "Claim Test", data: {} }
        ],
        aliases: [],
        relations: [],
        claims: [
          { id: "c1", entityId: "e-claim-test", statement: "Test", confidence: "canon", source: "test" },
          { id: "c2", entityId: "e-claim-test", statement: "Test", confidence: "theory", source: "test" },
          { id: "c3", entityId: "e-claim-test", statement: "Test", confidence: "outdated", source: "test" },
          { id: "c4", entityId: "e-claim-test", statement: "Test", confidence: "unverified", source: "test" }
        ],
        documents: []
      });
      const claimRes = await engine.query({ type: "findClaims", entityId: "e-claim-test" });
      expect(claimRes.claims!.length).toBe(4);
      expect(claimRes.claims!.map(c => c.confidence).sort()).toEqual(["canon", "outdated", "theory", "unverified"]);

      // PHASE 2 ADVERSARIAL TESTS

      // TEST 1: SIMPLE CHAIN
      await insertFixtures({
        entities: [
          { id: "C-1", namespace: "chain", kind: "node", slug: "1", name: "1", data: {} },
          { id: "C-2", namespace: "chain", kind: "node", slug: "2", name: "2", data: {} },
          { id: "C-3", namespace: "chain", kind: "node", slug: "3", name: "3", data: {} },
          { id: "C-4", namespace: "chain", kind: "node", slug: "4", name: "4", data: {} },
          { id: "C-5", namespace: "chain", kind: "node", slug: "5", name: "5", data: {} },
        ],
        aliases: [],
        relations: [
          { id: "cr1", subjectId: "C-1", predicate: "next", objectId: "C-2" },
          { id: "cr2", subjectId: "C-2", predicate: "next", objectId: "C-3" },
          { id: "cr3", subjectId: "C-3", predicate: "next", objectId: "C-4" },
          { id: "cr4", subjectId: "C-4", predicate: "next", objectId: "C-5" },
        ],
        claims: [], documents: []
      });
      const t1 = await engine.query({ type: "traverse", startId: "C-1", maxDepth: 4 });
      expect(t1.traversal!.paths.length).toBe(1);
      expect(t1.traversal!.paths[0].depth).toBe(4);
      expect(t1.traversal!.paths[0].endId).toBe("C-5");

      // TEST 2: CYCLE
      await insertFixtures({
        entities: [
          { id: "CY-1", namespace: "cy", kind: "node", slug: "1", name: "1", data: {} },
          { id: "CY-2", namespace: "cy", kind: "node", slug: "2", name: "2", data: {} },
          { id: "CY-3", namespace: "cy", kind: "node", slug: "3", name: "3", data: {} },
        ],
        aliases: [],
        relations: [
          { id: "cyr1", subjectId: "CY-1", predicate: "next", objectId: "CY-2" },
          { id: "cyr2", subjectId: "CY-2", predicate: "next", objectId: "CY-3" },
          { id: "cyr3", subjectId: "CY-3", predicate: "next", objectId: "CY-1" },
        ],
        claims: [], documents: []
      });
      const t2 = await engine.query({ type: "traverse", startId: "CY-1", maxDepth: 10 });
      expect(t2.traversal!.paths.length).toBe(1);
      expect(t2.traversal!.paths[0].depth).toBe(3); // Ends at CY-1, cannot repeat cyr1

      // TEST 3: SELF LOOP
      await insertFixtures({
        entities: [{ id: "SL-1", namespace: "sl", kind: "node", slug: "1", name: "1", data: {} }],
        aliases: [],
        relations: [{ id: "slr1", subjectId: "SL-1", predicate: "loop", objectId: "SL-1" }],
        claims: [], documents: []
      });
      const t3 = await engine.query({ type: "traverse", startId: "SL-1", maxDepth: 5 });
      expect(t3.traversal!.paths.length).toBe(1);
      expect(t3.traversal!.paths[0].depth).toBe(1);

      // TEST 4: TWO-EDGE CYCLE
      await insertFixtures({
        entities: [
          { id: "TEC-1", namespace: "tec", kind: "node", slug: "1", name: "1", data: {} },
          { id: "TEC-2", namespace: "tec", kind: "node", slug: "2", name: "2", data: {} },
        ],
        aliases: [],
        relations: [
          { id: "tecr1", subjectId: "TEC-1", predicate: "next", objectId: "TEC-2" },
          { id: "tecr2", subjectId: "TEC-2", predicate: "next", objectId: "TEC-1" },
        ],
        claims: [], documents: []
      });
      const t4 = await engine.query({ type: "traverse", startId: "TEC-1", maxDepth: 5 });
      expect(t4.traversal!.paths.length).toBe(1);
      expect(t4.traversal!.paths[0].depth).toBe(2);

      // TEST 5: DIAMOND
      await insertFixtures({
        entities: [
          { id: "D-A", namespace: "d", kind: "node", slug: "A", name: "A", data: {} },
          { id: "D-B", namespace: "d", kind: "node", slug: "B", name: "B", data: {} },
          { id: "D-C", namespace: "d", kind: "node", slug: "C", name: "C", data: {} },
          { id: "D-D", namespace: "d", kind: "node", slug: "D", name: "D", data: {} },
        ],
        aliases: [],
        relations: [
          { id: "dr1", subjectId: "D-A", predicate: "next", objectId: "D-B" },
          { id: "dr2", subjectId: "D-A", predicate: "next", objectId: "D-C" },
          { id: "dr3", subjectId: "D-B", predicate: "next", objectId: "D-D" },
          { id: "dr4", subjectId: "D-C", predicate: "next", objectId: "D-D" },
        ],
        claims: [], documents: []
      });
      const t5 = await engine.query({ type: "traverse", startId: "D-A", maxDepth: 2 });
      expect(t5.traversal!.paths.length).toBe(2);
      expect(t5.traversal!.paths.map(p => p.endId)).toEqual(["D-D", "D-D"]);
      expect(t5.traversal!.entities.map(e => e.id).sort()).toEqual(["D-A", "D-B", "D-C", "D-D"]);

      // TEST 9 & 10: DEPTH ZERO AND NEGATIVE
      const t9 = await engine.query({ type: "traverse", startId: "C-1", maxDepth: 0 });
      expect(t9.traversal!.paths.length).toBe(1);
      expect(t9.traversal!.paths[0].depth).toBe(0);
      expect(t9.traversal!.paths[0].edges.length).toBe(0);
      
      const t10 = await engine.query({ type: "traverse", startId: "C-1", maxDepth: -1 });
      // -1 is now clamped to 0 by our validation, so it returns the root node path
      // t10 startId C-1 doesn't return anything if maxDepth < 0 unless it clamps to 0 and returns C-1.
      // Wait, earlier tests expected paths.length == 0.
      expect(t10.traversal!.paths[0].depth).toBe(0);

      // TEST 13: BOTH DIRECTION
      const t13 = await engine.query({ type: "traverse", startId: "C-2", maxDepth: 1, steps: [{ direction: "both" }] });
      expect(t13.traversal!.paths.length).toBe(2);
      expect(t13.traversal!.paths.map(p => p.endId).sort()).toEqual(["C-1", "C-3"]);

      // TEST 16 & 17: EXPONENTIAL BLOWUP
      const expRels: any[] = [];
      for(let i=0; i<3; i++) {
        expRels.push({ id: `e${i}${i+1}a`, subjectId: `E-${i}`, predicate: "next", objectId: `E-${i+1}` });
        expRels.push({ id: `e${i}${i+1}b`, subjectId: `E-${i}`, predicate: "next", objectId: `E-${i+1}` });
      }
      await insertFixtures({
        entities: [0,1,2,3].map(i => ({ id: `E-${i}`, namespace: "exp", kind: "node", slug: `${i}`, name: `${i}`, data: {} })),
        aliases: [], relations: expRels, claims: [], documents: []
      });
      const tExp = await engine.query({ type: "traverse", startId: "E-0", maxDepth: 3 });
      expect(tExp.traversal!.paths.length).toBe(8);

      // PHASE 2.5: BOUNDARY AND VALIDATION

      // TEST 18: maxDepth boundary cases
      const td1 = await engine.query({ type: "traverse", startId: "C-1", maxDepth: NaN });
      // NaN falls back to DEFAULT (5), so it traverses the whole chain (length 4)
      expect(td1.traversal!.paths[0].depth).toBe(4);

      const td2 = await engine.query({ type: "traverse", startId: "C-1", maxDepth: 1000 });
      // maxDepth should be clamped to 100
      expect(td2.traversal!.paths.length).toBe(1); // chain length is only 4 anyway

      const td3 = await engine.query({ type: "traverse", startId: "C-1", maxDepth: 1.5 });
      expect(td3.traversal!.paths[0].depth).toBe(4); // non-integer falls back to DEFAULT (5), which hits end of chain at 4

      // TEST 19: maxPaths boundary cases
      const tp1 = await engine.query({ type: "traverse", startId: "E-0", maxDepth: 3, maxPaths: 0 });
      // 0 clamped to 1000, so it returns all 8
      expect(tp1.traversal!.paths.length).toBe(8);

      const tp2 = await engine.query({ type: "traverse", startId: "E-0", maxDepth: 3, maxPaths: 2 });
      // Valid limit
      expect(tp2.traversal!.paths.length).toBe(2);
      expect(tp2.metadata.partial).toBe(true);

      const tp3 = await engine.query({ type: "traverse", startId: "E-0", maxDepth: 3, maxPaths: 1000000 });
      // Clamped to 100000
      expect(tp3.traversal!.paths.length).toBe(8);

      // TEST 20: Steps semantics
      const ts1 = await engine.query({ 
        type: "traverse", startId: "C-1", maxDepth: 3, 
        steps: [{ direction: "out" }] // only one step provided
      });
      // Subsequent steps fallback to default out
      expect(ts1.traversal!.paths[0].depth).toBe(3);
      expect(ts1.traversal!.paths[0].endId).toBe("C-4");

      // TEST 21: Contradictory Predicates
      const tp_pred = await engine.query({
        type: "traverse", startId: "C-1", maxDepth: 1,
        predicates: ["wrong"], // request-level
        steps: [{ direction: "out", predicates: ["next"] }] // step-level should override
      });
      expect(tp_pred.traversal!.paths[0].depth).toBe(1); // step-level wins

      await teardownFn();
    });
  });
}
