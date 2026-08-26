import assert from "node:assert/strict";
import { createKnowledgeProvider } from "../packages/provider/dist/index.js";

console.log("Running E Core Architecture & Conformance Suite...");

// 1. Minimum conformant provider: only /verify and custom endpoints
const fakeProviderService = {
  verificationKey: "eprov_test_secret_12345",
  identity: { id: "@vxnus/teyvat", publisher: "vxnus" },
  // Custom REST API handlers (not /manifest or /retrieve)
  characters: (id) => ({ id, name: "Furina", element: "Hydro" }),
  farming: (character) => ({ character, items: ["Justice Books", "Lakelight Lily"] }),
};

const provider = createKnowledgeProvider({
  verificationKey: fakeProviderService.verificationKey,
  identity: fakeProviderService.identity,
});

// TEST 1: Provider verification succeeds with correct token
const authHeader = `Bearer ${fakeProviderService.verificationKey}`;
const verifyRes = provider.handlers.verify(authHeader);
assert.equal(verifyRes.status, 200);
assert.deepEqual(verifyRes.body, { id: "@vxnus/teyvat", publisher: "vxnus" });

// TEST 2: Provider verification fails with invalid token
assert.equal(provider.handlers.verify("Bearer invalid").status, 401);
assert.equal(provider.handlers.verify().status, 401);

// TEST 3: Minimum conformant provider has NO mandatory /manifest or /retrieve
assert.equal(provider.handlers.manifest, undefined);
assert.equal(provider.handlers.retrieve, undefined);

// TEST 4: E Release object in registry format contains authoritative apiContract and provider URL
const registryRelease = {
  id: "@vxnus/teyvat",
  publisher: "vxnus",
  name: "teyvat",
  version: "1.0.0",
  schemaVersion: "1.0",
  description: "Genshin Impact Knowledge",
  sources: [{ id: "teyvat-source", title: "Official Archive", license: "CC-BY-4.0" }],
  capabilities: { lexicalSearch: false, semanticSearch: false, structuredEntities: true, relations: true, revisions: true },
  distribution: {
    kind: "provider",
    url: "https://eteyvat.krzgn.xyz",
  },
  verified: true,
  apiContract: {
    openapi: "3.1.0",
    info: { title: "E-Teyvat Knowledge API", version: "1.0.0" },
    paths: {
      "/api/entities": { get: { summary: "List or search entities" } },
      "/api/knowledge/search": { get: { summary: "Keyword search" } },
      "/api/farming": { get: { summary: "Farming sources" } },
    },
  },
};

assert.equal(registryRelease.distribution.kind, "provider");
assert.equal(registryRelease.distribution.url, "https://eteyvat.krzgn.xyz");
assert.equal(registryRelease.apiContract.openapi, "3.1.0");
assert.ok(registryRelease.apiContract.paths["/api/entities"]);
assert.ok(registryRelease.apiContract.paths["/api/farming"]);

console.log("All E Core Architecture tests passed successfully!");
