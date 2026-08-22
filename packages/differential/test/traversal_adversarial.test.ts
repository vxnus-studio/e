import { test, describe, expect, beforeAll, afterAll } from "vitest";
import { InMemoryEngine } from "@vxnus/e";
import { SqliteEngine } from "@vxnus/e-sqlite";
import { PostgresEngine } from "@vxnus/e-postgres";
import type { Entity, Relation } from "@vxnus/e";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

function createEntity(id: string, name: string = id): Entity {
  return { id, namespace: "trav", kind: "node", slug: name.toLowerCase(), name, data: {} };
}

describe("Traversal Adversarial & Boundary Verification", () => {
  let memEngine: InMemoryEngine;
  let sqlEngine: SqliteEngine;
  let pgEngine: PostgresEngine | undefined;

  let engines: { name: string; engine: any; insert: (f: any) => Promise<void> }[] = [];

  beforeAll(async () => {
    memEngine = new InMemoryEngine();
    engines.push({
      name: "InMemory",
      engine: memEngine,
      insert: async (f) => {
        for (const e of (f.entities || [])) memEngine.insertEntity(e);
        for (const a of (f.aliases || [])) memEngine.insertAlias(a);
        for (const r of (f.relations || [])) memEngine.insertRelation(r);
        for (const c of (f.claims || [])) memEngine.insertClaim(c);
        for (const d of (f.documents || [])) memEngine.insertDocument(d);
      }
    });

    sqlEngine = new SqliteEngine(":memory:");
    engines.push({
      name: "SQLite",
      engine: sqlEngine,
      insert: async (f) => {
        for (const e of (f.entities || [])) sqlEngine.insertEntity(e);
        for (const a of (f.aliases || [])) sqlEngine.insertAlias(a);
        for (const r of (f.relations || [])) sqlEngine.insertRelation(r);
        for (const c of (f.claims || [])) sqlEngine.insertClaim(c);
        for (const d of (f.documents || [])) sqlEngine.insertDocument(d);
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
          insert: async (f) => {
            for (const e of (f.entities || [])) await pgEngine!.insertEntity(e);
            for (const a of (f.aliases || [])) await pgEngine!.insertAlias(a);
            for (const r of (f.relations || [])) await pgEngine!.insertRelation(r);
            for (const c of (f.claims || [])) await pgEngine!.insertClaim(c);
            for (const d of (f.documents || [])) await pgEngine!.insertDocument(d);
          }
        });
      } catch (e) {
        console.warn("PostgreSQL not initialized for traversal tests: ", e);
      }
    }
  });

  afterAll(async () => {
    sqlEngine.close();
    if (pgEngine) await pgEngine.close();
  });

  test("Converging diamond path correctness: path-local visited semantics preserve all valid distinct paths", async () => {
    // Diamond: A -> B -> D, A -> C -> D
    const f = {
      entities: ["D-A", "D-B", "D-C", "D-D"].map(id => createEntity(id)),
      relations: [
        { id: "dr1", subjectId: "D-A", predicate: "to", objectId: "D-B" },
        { id: "dr2", subjectId: "D-A", predicate: "to", objectId: "D-C" },
        { id: "dr3", subjectId: "D-B", predicate: "to", objectId: "D-D" },
        { id: "dr4", subjectId: "D-C", predicate: "to", objectId: "D-D" }
      ]
    };

    for (const e of engines) {
      await e.insert(f);
      const res = await e.engine.query({ type: "traverse", startId: "D-A", maxDepth: 2 });
      
      expect(res.traversal?.paths.length, `Engine ${e.name} should find 2 paths to D`).toBe(2);
      expect(res.traversal?.paths.map((p: any) => p.endId)).toEqual(["D-D", "D-D"]);
      expect(res.traversal?.entities.map((ent: any) => ent.id).sort()).toEqual(["D-A", "D-B", "D-C", "D-D"]);
    }
  });

  test("Cycle termination: graph with 3-node cycle terminates without repeating edges", async () => {
    // Cycle: CY1 -> CY2 -> CY3 -> CY1
    const f = {
      entities: ["CY1", "CY2", "CY3"].map(id => createEntity(id)),
      relations: [
        { id: "cyr1", subjectId: "CY1", predicate: "step", objectId: "CY2" },
        { id: "cyr2", subjectId: "CY2", predicate: "step", objectId: "CY3" },
        { id: "cyr3", subjectId: "CY3", predicate: "step", objectId: "CY1" }
      ]
    };

    for (const e of engines) {
      await e.insert(f);
      const res = await e.engine.query({ type: "traverse", startId: "CY1", maxDepth: 10 });
      expect(res.traversal?.paths.length).toBe(1);
      expect(res.traversal?.paths[0].depth).toBe(3);
      expect(res.traversal?.paths[0].endId).toBe("CY1");
    }
  });

  test("Self-loop edge produces valid depth-1 path and terminates without infinite loop", async () => {
    const f = {
      entities: [createEntity("SL1")],
      relations: [{ id: "slr1", subjectId: "SL1", predicate: "self", objectId: "SL1" }]
    };

    for (const e of engines) {
      await e.insert(f);
      const res = await e.engine.query({ type: "traverse", startId: "SL1", maxDepth: 5 });
      expect(res.traversal?.paths.length).toBe(1);
      expect(res.traversal?.paths[0].depth).toBe(1);
      expect(res.traversal?.paths[0].endId).toBe("SL1");
    }
  });

  test("Intermediate frontier bounding on dense fan-out graph: maxPaths=1 bounds intermediate allocation", async () => {
    // Dense 1-to-100 fan-out
    const fanEntities = [createEntity("FAN-ROOT")];
    const fanRelations: Relation[] = [];
    for (let i = 0; i < 100; i++) {
      fanEntities.push(createEntity(`FAN-LEAF-${i}`));
      fanRelations.push({
        id: `rel-fan-${i}`,
        subjectId: "FAN-ROOT",
        predicate: "branches",
        objectId: `FAN-LEAF-${i}`
      });
    }

    for (const e of engines) {
      await e.insert({ entities: fanEntities, relations: fanRelations });

      // Request maxPaths = 2
      const res = await e.engine.query({ type: "traverse", startId: "FAN-ROOT", maxDepth: 1, maxPaths: 2 });
      expect(res.traversal?.paths.length).toBe(2);
      expect(res.metadata.partial).toBe(true);
      expect(res.metadata.warnings).toContain("Traversal reached maxPaths limit");

      // Verify maxRelationsExpanded safety ceiling stops intermediate expansion
      const boundedRelRes = await e.engine.query({
        type: "traverse",
        startId: "FAN-ROOT",
        maxDepth: 1,
        maxRelationsExpanded: 5,
        maxPaths: 50
      });
      expect(boundedRelRes.metadata.partial).toBe(true);
      expect(boundedRelRes.traversal?.relations.length).toBeLessThanOrEqual(5);
      expect(boundedRelRes.metadata.warnings?.some((w: string) => w.includes("maxRelationsExpanded"))).toBe(true);

      // Verify maxEntitiesHydrated safety ceiling stops intermediate entity hydration
      const boundedEntRes = await e.engine.query({
        type: "traverse",
        startId: "FAN-ROOT",
        maxDepth: 1,
        maxEntitiesHydrated: 3,
        maxPaths: 50
      });
      expect(boundedEntRes.metadata.partial).toBe(true);
      expect(boundedEntRes.traversal?.entities.length).toBeLessThanOrEqual(3);
      expect(boundedEntRes.metadata.warnings?.some((w: string) => w.includes("maxEntitiesHydrated"))).toBe(true);
    }
  });

  test("Relation work budget is shared across frontier nodes instead of starving later nodes", async () => {
    const entities = ["FAIR-ROOT", "FAIR-B", "FAIR-C"]
      .concat(Array.from({ length: 6 }, (_, i) => `FAIR-B-${i}`))
      .concat(["FAIR-C-0"])
      .map(id => createEntity(id));
    const relations: Relation[] = [
      { id: "fair-root-b", subjectId: "FAIR-ROOT", predicate: "next", objectId: "FAIR-B" },
      { id: "fair-root-c", subjectId: "FAIR-ROOT", predicate: "next", objectId: "FAIR-C" },
      ...Array.from({ length: 6 }, (_, i) => ({
        id: `fair-b-${i}`,
        subjectId: "FAIR-B",
        predicate: "next",
        objectId: `FAIR-B-${i}`,
      })),
      { id: "fair-c-0", subjectId: "FAIR-C", predicate: "next", objectId: "FAIR-C-0" },
    ];

    for (const e of engines) {
      await e.insert({ entities, relations });
      const result = await e.engine.query({
        type: "traverse",
        startId: "FAIR-ROOT",
        maxDepth: 2,
        maxRelationsExpanded: 4,
        maxPaths: 20,
      });
      const pathEnds = result.traversal?.paths.map((path: any) => path.endId) ?? [];
      expect(pathEnds, `Engine ${e.name} starved FAIR-C`).toContain("FAIR-C-0");
      expect(result.metadata.partial).toBe(true);
      expect(result.metadata.warnings?.some((warning: string) => warning.includes("maxRelationsExpanded"))).toBe(true);
    }
  });

  test("Bidirectional incoming and outgoing traversal parity", async () => {
    // Node-1 -> Node-2 <- Node-3
    const f = {
      entities: [createEntity("N1"), createEntity("N2"), createEntity("N3")],
      relations: [
        { id: "r12", subjectId: "N1", predicate: "connects", objectId: "N2" },
        { id: "r32", subjectId: "N3", predicate: "connects", objectId: "N2" }
      ]
    };

    for (const e of engines) {
      await e.insert(f);

      // Traversal from N2 with direction 'in'
      const inRes = await e.engine.query({
        type: "traverse",
        startId: "N2",
        steps: [{ direction: "in" }],
        maxDepth: 1
      });
      expect(inRes.traversal?.paths.length).toBe(2);
      expect(inRes.traversal?.paths.map((p: any) => p.endId).sort()).toEqual(["N1", "N3"]);
      expect(inRes.traversal?.paths[0].edges[0].direction).toBe("in");
    }
  });

  test("Deterministic path sort ordering across backends", async () => {
    // Multi-path graph
    const f = {
      entities: ["O-ROOT", "O-A", "O-B", "O-C"].map(id => createEntity(id)),
      relations: [
        { id: "rel-c", subjectId: "O-ROOT", predicate: "edge", objectId: "O-C" },
        { id: "rel-a", subjectId: "O-ROOT", predicate: "edge", objectId: "O-A" },
        { id: "rel-b", subjectId: "O-ROOT", predicate: "edge", objectId: "O-B" }
      ]
    };

    const results = [];
    for (const e of engines) {
      await e.insert(f);
      const res = await e.engine.query({ type: "traverse", startId: "O-ROOT", maxDepth: 1 });
      results.push({ name: e.name, paths: res.traversal?.paths });
    }

    const baseline = results[0].paths;
    for (let i = 1; i < results.length; i++) {
      expect(results[i].paths, `Engine ${results[i].name} sort order mismatch`).toEqual(baseline);
    }
  });

  test("Strict traversal limit boundaries: observable results NEVER exceed configured limits", async () => {
    // Highly connected mesh graph: 20 nodes, every node connected to next 3 nodes
    const meshEntities: Entity[] = [];
    const meshRelations: Relation[] = [];
    for (let i = 0; i < 20; i++) {
      meshEntities.push(createEntity(`MESH-${i}`));
    }
    let relId = 0;
    for (let i = 0; i < 20; i++) {
      for (let j = 1; j <= 3; j++) {
        const target = (i + j) % 20;
        meshRelations.push({
          id: `mesh-rel-${relId++}`,
          subjectId: `MESH-${i}`,
          predicate: "points_to",
          objectId: `MESH-${target}`
        });
      }
    }

    for (const e of engines) {
      await e.insert({ entities: meshEntities, relations: meshRelations });

      // 1. maxDepth = 0 must return depth 0 only (single root path, 0 relations, 1 entity)
      const resD0 = await e.engine.query({ type: "traverse", startId: "MESH-0", maxDepth: 0 });
      expect(resD0.traversal?.paths.length).toBe(1);
      expect(resD0.traversal?.paths[0].depth).toBe(0);
      expect(resD0.traversal?.relations.length).toBe(0);
      expect(resD0.traversal?.entities.length).toBe(1);

      // 2. maxDepth = 1 must strictly contain paths of depth <= 1
      const resD1 = await e.engine.query({ type: "traverse", startId: "MESH-0", maxDepth: 1 });
      for (const p of resD1.traversal?.paths || []) {
        expect(p.depth).toBeLessThanOrEqual(1);
      }

      // 3. maxPaths strict limit: maxPaths = 4 on dense graph
      const resP4 = await e.engine.query({ type: "traverse", startId: "MESH-0", maxDepth: 5, maxPaths: 4 });
      expect(resP4.traversal?.paths.length).toBeLessThanOrEqual(4);
      expect(resP4.metadata.partial).toBe(true);

      // 4. maxRelationsExpanded strict limit: maxRelationsExpanded = 7
      const resRel7 = await e.engine.query({
        type: "traverse",
        startId: "MESH-0",
        maxDepth: 5,
        maxRelationsExpanded: 7
      });
      expect(resRel7.traversal?.relations.length).toBeLessThanOrEqual(7);

      // 5. maxEntitiesHydrated strict limit: maxEntitiesHydrated = 5
      const resEnt5 = await e.engine.query({
        type: "traverse",
        startId: "MESH-0",
        maxDepth: 5,
        maxEntitiesHydrated: 5
      });
      expect(resEnt5.traversal?.entities.length).toBeLessThanOrEqual(5);
    }
  });

  test("Traversal parity on massive dense graph (>500 relations, maxRelationsExpanded < 500)", async () => {
    // 600 relations from root
    const bigRoot = createEntity("BIG-ROOT");
    const bigEntities = [bigRoot];
    const bigRelations: Relation[] = [];
    for (let i = 0; i < 600; i++) {
      const leaf = createEntity(`BIG-LEAF-${String(i).padStart(4, "0")}`);
      bigEntities.push(leaf);
      bigRelations.push({
        id: `big-rel-${String(i).padStart(4, "0")}`,
        subjectId: "BIG-ROOT",
        predicate: i % 2 === 0 ? "even" : "odd",
        objectId: leaf.id
      });
    }

    const queryResults: any[] = [];

    for (const e of engines) {
      await e.insert({ entities: bigEntities, relations: bigRelations });

      // Traversal with maxRelationsExpanded = 250 (less than 500 chunk size and total 600)
      const res = await e.engine.query({
        type: "traverse",
        startId: "BIG-ROOT",
        predicates: ["even"],
        maxDepth: 1,
        maxRelationsExpanded: 250,
        maxPaths: 300
      });

      expect(res.traversal?.relations.length).toBe(250);
      expect(res.traversal?.paths.length).toBe(250);
      expect(res.metadata.partial).toBe(true);

      queryResults.push({ name: e.name, res });
    }

    // Compare parity across engines
    const baseline = queryResults[0].res;
    for (let i = 1; i < queryResults.length; i++) {
      const current = queryResults[i];
      expect(
        current.res.traversal?.paths.map((p: any) => p.endId),
        `Engine ${current.name} paths mismatch against ${queryResults[0].name}`
      ).toEqual(baseline.traversal?.paths.map((p: any) => p.endId));

      expect(
        current.res.traversal?.relations.map((r: any) => r.id),
        `Engine ${current.name} relations mismatch against ${queryResults[0].name}`
      ).toEqual(baseline.traversal?.relations.map((r: any) => r.id));
    }
  });
});
