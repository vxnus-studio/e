import assert from "node:assert/strict";
import { createKnowledgeProvider } from "../packages/provider/dist/index.js";
import { ManifestValidationError, RetrievalValidationError } from "../packages/protocol/dist/index.js";

const manifest = {
  id: "@acme/teyvat",
  name: "Teyvat Knowledge",
  publisher: "acme",
  version: "1.0.0",
  schemaVersion: "1.0",
  sources: [{ id: "handbook", title: "Official Handbook", license: "CC-BY-4.0" }],
  capabilities: { lexicalSearch: true, semanticSearch: false, structuredEntities: true, relations: true, revisions: true },
};

const provider = createKnowledgeProvider({
  manifest,
  verificationKey: "secret-key",
  retrieve: (request) => ({
    revision: "r1",
    results: request.query ? [{ id: "chunk-1", content: "A cited fact.", revision: "r1", citations: [{ sourceId: "handbook", chunkId: "chunk-1" }] }] : [],
  }),
});

assert.equal(provider.handlers.manifest().id, "@acme/teyvat");
assert.equal((await provider.handlers.retrieve({ query: "fact", mode: "lexical" })).results.length, 1);
assert.equal(provider.handlers.verify("Bearer secret-key").status, 200);
assert.equal(provider.handlers.verify("Bearer wrong-key").status, 401);
assert.equal(provider.handlers.verify("Bearer secret-key").body.id, "@acme/teyvat");
await assert.rejects(() => provider.handlers.retrieve({ query: "fact", mode: "semantic" }));
const invalidProvider = createKnowledgeProvider({ manifest, verificationKey: "secret-key", retrieve: () => ({ revision: "r1", results: [{ id: "uncited", content: "Missing citation", revision: "r1", citations: [] }] }) });
await assert.rejects(() => invalidProvider.handlers.retrieve({ query: "fact" }), RetrievalValidationError);
assert.throws(() => createKnowledgeProvider({ manifest: { ...manifest, id: "" }, verificationKey: "secret-key", retrieve: () => ({ revision: "r1", results: [] }) }), ManifestValidationError);
console.log("Provider SDK passed.");
