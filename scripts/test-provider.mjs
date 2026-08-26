import assert from "node:assert/strict";
import { createKnowledgeProvider } from "../packages/provider/dist/index.js";
import { RetrievalValidationError } from "../packages/protocol/dist/index.js";

// TEST 1: Provider with only verification key is valid (no manifest, no retrieve)
const minimalProvider = createKnowledgeProvider({
  verificationKey: "secret-key",
  identity: { id: "@acme/teyvat", publisher: "acme" },
});

assert.equal(minimalProvider.handlers.verify("Bearer secret-key").status, 200);
assert.equal(minimalProvider.handlers.verify("Bearer secret-key").body.id, "@acme/teyvat");
assert.equal(minimalProvider.handlers.verify("Bearer wrong-key").status, 401);
assert.equal(minimalProvider.handlers.manifest, undefined);
assert.equal(minimalProvider.handlers.retrieve, undefined);

// TEST 2: Provider without manifest() is valid
assert.equal(typeof minimalProvider.handlers.verify, "function");

// TEST 3 & 4: Provider with optional retrieve works as expected
const fullProvider = createKnowledgeProvider({
  verificationKey: "secret-key",
  identity: { id: "@acme/teyvat", publisher: "acme" },
  retrieve: (request) => ({
    revision: "r1",
    results: request.query ? [{ id: "chunk-1", content: "A cited fact.", revision: "r1", citations: [{ sourceId: "handbook", chunkId: "chunk-1" }] }] : [],
  }),
});

assert.equal(fullProvider.handlers.verify("Bearer secret-key").status, 200);
assert.equal((await fullProvider.handlers.retrieve({ query: "fact", mode: "lexical" })).results.length, 1);

// TEST 5: Verification requires a valid non-empty key
assert.throws(() => createKnowledgeProvider({ verificationKey: "" }));

// TEST 6: Invalid retrieval response throws RetrievalValidationError
const invalidProvider = createKnowledgeProvider({
  verificationKey: "secret-key",
  retrieve: () => ({ revision: "r1", results: [{ id: "uncited", content: "Missing citation", revision: "r1", citations: [] }] }),
});
await assert.rejects(() => invalidProvider.handlers.retrieve({ query: "fact" }), RetrievalValidationError);

console.log("Provider SDK tests passed.");
