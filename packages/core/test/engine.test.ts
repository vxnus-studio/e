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
