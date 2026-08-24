import assert from "node:assert/strict";
import { loadPack } from "../packages/pack/dist/index.js";
import { assertConformantProvider, RetrievalValidationError, validateRetrievalResponse } from "../packages/protocol/dist/index.js";

const pack = await loadPack(new URL("../packages/pack/fixtures/sample", import.meta.url).pathname);
assert.equal(pack.manifest.id, "sample-knowledge");
assert.equal(pack.revision.id, "r1");
const response = await pack.provider.retrieve({ query: "grounded facts" });
assert.equal(response.results.length, 1);
assert.equal(response.results[0].revision, "r1");
assert.deepEqual(response.results[0].citations[0], { sourceId: "handbook", documentId: "intro", chunkId: "intro-1" });
await assertConformantProvider(pack.provider);
assert.throws(() => validateRetrievalResponse({ results: [{ id: "x", content: "uncited", revision: "r1", citations: [] }], revision: "r1" }, pack.manifest), RetrievalValidationError);
await assert.rejects(() => loadPack(new URL("../packages/pack/fixtures/sample-invalid", import.meta.url).pathname));
console.log("Pack fixtures passed.");
