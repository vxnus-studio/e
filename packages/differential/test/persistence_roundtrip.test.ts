import { test, describe, expect, beforeAll, afterAll } from "vitest";
import { InMemoryEngine } from "@vxnus/e";
import { SqliteEngine } from "@vxnus/e-sqlite";
import { PostgresEngine } from "@vxnus/e-postgres";
import type { Entity, Relation, Claim, Document } from "@vxnus/e";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

describe("Cross-Backend Persistence Round-Trip Contract Audit", () => {
  let memEngine: InMemoryEngine;
  let sqlEngine: SqliteEngine;
  let pgEngine: PostgresEngine | undefined;

  let engines: { name: string; engine: any; insert: (f: any) => Promise<void> }[] = [];

  beforeAll(async () => {
    // 1. InMemory
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

    // 2. SQLite
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

    // 3. PostgreSQL
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
        if (process.env.CI) throw e;
        console.warn("PostgreSQL not initialized: ", e);
      }
    }
  });

  afterAll(async () => {
    sqlEngine.close();
    if (pgEngine) await pgEngine.close();
  });

  const fullEntity: Entity = {
    id: "ent-full-1",
    namespace: "lore",
    kind: "character",
    slug: "zhongli",
    name: "Zhongli",
    data: { element: "geo", weapon: "polearm", nested: { rarity: 5 } },
    identities: [
      { provider: "hoyoverse", externalId: "10000030" },
      { provider: "genshindb", externalId: "zhongli" }
    ],
    provenance: {
      provider: "fandom-crawler",
      source: "https://genshin-impact.fandom.com",
      sourceId: "page-1234",
      confidence: "canon",
      observedAt: "2026-01-01T00:00:00Z"
    },
    temporal: {
      observedAt: "2026-01-01T00:00:00Z",
      validFrom: "2020-09-28T00:00:00Z"
    }
  };

  const targetEntity: Entity = {
    id: "ent-full-2",
    namespace: "lore",
    kind: "region",
    slug: "liyue",
    name: "Liyue",
    data: {}
  };

  const fullRelation: Relation = {
    id: "rel-full-1",
    subjectId: "ent-full-1",
    predicate: "protects",
    objectId: "ent-full-2",
    metadata: { role: "Archon", tenureYears: 6000 },
    provenance: { provider: "lore-book", confidence: "canon" },
    temporal: { validFrom: "Ancient Era" }
  };

  const fullClaim: Claim = {
    id: "claim-full-1",
    entityId: "ent-full-1",
    statement: "Zhongli is the Geo Archon Morax.",
    confidence: "canon",
    source: "Archon Quest Chapter I",
    provenance: { provider: "game-script" },
    temporal: { observedAt: "2020-11-11" }
  };

  const fullDocument: Document = {
    id: "doc-full-1",
    entityId: "ent-full-1",
    content: "Zhongli is currently working as a consultant at Wangsheng Funeral Parlor.",
    provenance: { provider: "character-story" }
  };

  test("Entity primary fields round-trip across all backends", async () => {
    for (const e of engines) {
      await e.insert({ entities: [fullEntity, targetEntity] });

      const res = await e.engine.query({ type: "getEntity", id: "ent-full-1" });
      expect(res.entities?.length).toBe(1);
      const ent = res.entities![0];

      expect(ent.id).toBe("ent-full-1");
      expect(ent.namespace).toBe("lore");
      expect(ent.kind).toBe("character");
      expect(ent.slug).toBe("zhongli");
      expect(ent.name).toBe("Zhongli");
      expect(ent.data).toEqual(fullEntity.data);
    }
  });

  test("Entity metadata fields round-trip across all engines (identities, provenance, temporal)", async () => {
    for (const e of engines) {
      const res = await e.engine.query({ type: "getEntity", id: "ent-full-1" });
      const ent = res.entities![0];

      expect(ent.identities, `Engine ${e.name} identities mismatch`).toEqual(fullEntity.identities);
      expect(ent.provenance, `Engine ${e.name} provenance mismatch`).toEqual(fullEntity.provenance);
      expect(ent.temporal, `Engine ${e.name} temporal mismatch`).toEqual(fullEntity.temporal);
    }
  });

  test("Relation metadata, provenance, and temporal round-trip across all engines", async () => {
    for (const e of engines) {
      await e.insert({ relations: [fullRelation] });

      const res = await e.engine.query({ type: "findRelations", subjectId: "ent-full-1" });
      expect(res.relations?.length).toBe(1);
      const rel = res.relations![0];

      expect(rel.id).toBe("rel-full-1");
      expect(rel.subjectId).toBe("ent-full-1");
      expect(rel.predicate).toBe("protects");
      expect(rel.objectId).toBe("ent-full-2");
      expect(rel.metadata, `Engine ${e.name} relation metadata mismatch`).toEqual(fullRelation.metadata);
      expect(rel.provenance, `Engine ${e.name} relation provenance mismatch`).toEqual(fullRelation.provenance);
      expect(rel.temporal, `Engine ${e.name} relation temporal mismatch`).toEqual(fullRelation.temporal);
    }
  });

  test("Claim provenance and temporal round-trip across all engines", async () => {
    for (const e of engines) {
      await e.insert({ claims: [fullClaim] });

      const res = await e.engine.query({ type: "findClaims", entityId: "ent-full-1" });
      expect(res.claims?.length).toBe(1);
      const claim = res.claims![0];

      expect(claim.id).toBe("claim-full-1");
      expect(claim.statement).toBe(fullClaim.statement);
      expect(claim.confidence).toBe(fullClaim.confidence);
      expect(claim.source).toBe(fullClaim.source);
      expect(claim.provenance, `Engine ${e.name} claim provenance mismatch`).toEqual(fullClaim.provenance);
      expect(claim.temporal, `Engine ${e.name} claim temporal mismatch`).toEqual(fullClaim.temporal);
    }
  });

  test("Document provenance round-trip across all engines", async () => {
    for (const e of engines) {
      await e.insert({ documents: [fullDocument] });

      const res = await e.engine.query({ type: "findDocuments", entityId: "ent-full-1" });
      expect(res.documents?.length).toBe(1);
      const doc = res.documents![0];

      expect(doc.id).toBe("doc-full-1");
      expect(doc.content).toBe(fullDocument.content);
      expect(doc.provenance, `Engine ${e.name} document provenance mismatch`).toEqual(fullDocument.provenance);
    }
  });

  test("InMemory mutation isolation: caller cannot mutate internal state via input object", async () => {
    const mutableData: Record<string, any> = { score: 100, nested: { value: "original" } };
    const mutableIdentities = [{ provider: "test", externalId: "123" }];
    const ent: Entity = {
      id: "ent-mut-in",
      namespace: "test",
      kind: "test",
      slug: "mut-in",
      name: "Mut In",
      data: mutableData,
      identities: mutableIdentities
    };

    memEngine.insertEntity(ent);

    // Mutate caller-owned input
    mutableData.score = 999;
    mutableData.nested.value = "corrupted";
    mutableIdentities[0].externalId = "hacked";

    const res = await memEngine.query({ type: "getEntity", id: "ent-mut-in" });
    const fetched = res.entities![0];

    // Assert internal state remained isolated
    expect(fetched.data.score).toBe(100);
    expect((fetched.data.nested as any).value).toBe("original");
    expect(fetched.identities![0].externalId).toBe("123");
  });

  test("InMemory mutation isolation: caller cannot mutate internal state via returned object", async () => {
    const res1 = await memEngine.query({ type: "getEntity", id: "ent-mut-in" });
    const fetched1 = res1.entities![0];

    // Mutate returned object
    fetched1.data.score = 777;
    (fetched1.data.nested as any).value = "tampered";
    fetched1.identities![0].externalId = "tampered-id";

    // Query again
    const res2 = await memEngine.query({ type: "getEntity", id: "ent-mut-in" });
    const fetched2 = res2.entities![0];

    // Assert internal state remains uncorrupted
    expect(fetched2.data.score).toBe(100);
    expect((fetched2.data.nested as any).value).toBe("original");
    expect(fetched2.identities![0].externalId).toBe("123");
  });

  test("Complex metadata with nulls, booleans, arrays, empty objects round-trips identically", async () => {
    const complexEntity: Entity = {
      id: "ent-complex-1",
      namespace: "test",
      kind: "test",
      slug: "complex",
      name: "Complex",
      data: {
        booleanTrue: true,
        booleanFalse: false,
        zeroNumber: 0,
        emptyString: "",
        emptyArray: [],
        emptyObject: {},
        nestedArray: [1, "two", { three: 3 }],
        nullValue: null
      }
    };

    for (const e of engines) {
      await e.insert({ entities: [complexEntity] });
      const res = await e.engine.query({ type: "getEntity", id: "ent-complex-1" });
      expect(res.entities![0].data, `Engine ${e.name} complex JSON roundtrip mismatch`).toEqual(complexEntity.data);
    }
  });

  test("Canonical JSON rejection: non-JSON and invalid values throw ConstraintError uniformly", async () => {
    for (const e of engines) {
      // 1. undefined in object property
      await expect(async () => {
        await e.engine.insertEntity({
          id: "ent-bad-undef",
          namespace: "test",
          kind: "test",
          slug: "bad-undef",
          name: "Bad Undef",
          data: { invalidProp: undefined as any }
        });
      }).rejects.toThrow(/undefined/);

      // 2. NaN
      await expect(async () => {
        await e.engine.insertEntity({
          id: "ent-bad-nan",
          namespace: "test",
          kind: "test",
          slug: "bad-nan",
          name: "Bad NaN",
          data: { score: NaN }
        });
      }).rejects.toThrow(/finite/);

      // 3. Infinity / -Infinity
      await expect(async () => {
        await e.engine.insertEntity({
          id: "ent-bad-inf",
          namespace: "test",
          kind: "test",
          slug: "bad-inf",
          name: "Bad Inf",
          data: { score: Infinity }
        });
      }).rejects.toThrow(/finite/);

      // 4. BigInt
      await expect(async () => {
        await e.engine.insertEntity({
          id: "ent-bad-bigint",
          namespace: "test",
          kind: "test",
          slug: "bad-bigint",
          name: "Bad BigInt",
          data: { big: BigInt(123) as any }
        });
      }).rejects.toThrow(/bigint/);

      // 5. Date object
      await expect(async () => {
        await e.engine.insertEntity({
          id: "ent-bad-date",
          namespace: "test",
          kind: "test",
          slug: "bad-date",
          name: "Bad Date",
          data: { createdAt: new Date() as any }
        });
      }).rejects.toThrow(/custom class or non-plain object/);

      // 6. Map / Set
      await expect(async () => {
        await e.engine.insertEntity({
          id: "ent-bad-map",
          namespace: "test",
          kind: "test",
          slug: "bad-map",
          name: "Bad Map",
          data: { map: new Map() as any }
        });
      }).rejects.toThrow(/custom class or non-plain object/);

      await expect(async () => {
        await e.engine.insertEntity({
          id: "ent-bad-set",
          namespace: "test",
          kind: "test",
          slug: "bad-set",
          name: "Bad Set",
          data: { set: new Set() as any }
        });
      }).rejects.toThrow(/custom class or non-plain object/);

      // 7. Cyclic structure
      const cyclicObj: any = { name: "cyclic" };
      cyclicObj.self = cyclicObj;
      await expect(async () => {
        await e.engine.insertEntity({
          id: "ent-bad-cycle",
          namespace: "test",
          kind: "test",
          slug: "bad-cycle",
          name: "Bad Cycle",
          data: cyclicObj
        });
      }).rejects.toThrow(/cyclic/);

      // 8. Custom class instance
      class CustomItem {
        value = 42;
      }
      await expect(async () => {
        await e.engine.insertEntity({
          id: "ent-bad-class",
          namespace: "test",
          kind: "test",
          slug: "bad-class",
          name: "Bad Class",
          data: { item: new CustomItem() as any }
        });
      }).rejects.toThrow(/custom class or non-plain object/);

      // 9. Relation metadata with non-JSON values
      await expect(async () => {
        await e.engine.insertRelation({
          id: "rel-bad-meta",
          subjectId: "ent-full-1",
          predicate: "links",
          objectId: "ent-full-2",
          metadata: { num: NaN }
        });
      }).rejects.toThrow(/finite/);
    }
  });
});
