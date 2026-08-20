import { InMemoryEngine } from "../dist/index.js";

async function run() {
  const engine = new InMemoryEngine();
  engine.insertEntity({ id: "1", namespace: "test", kind: "test", slug: "test", name: "Test", data: {} });
  
  const result = await engine.query({ type: "getEntity", id: "1" });
  if (result.entities.length !== 1) {
    throw new Error("Failed to get entity");
  }
  console.log("Consumption verification passed!");
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
