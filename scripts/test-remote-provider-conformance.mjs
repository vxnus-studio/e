import assert from "node:assert/strict";
import http from "node:http";

console.log("Running Remote Provider Conformance & Auto-Discovery Test Suite...");

let testPort = 9876;
const expectedKey = "eprov_test_secret_123";

// Create Mock Remote Provider
const server = http.createServer((req, res) => {
  const auth = req.headers["authorization"];
  const url = new URL(req.url, `http://localhost:${testPort}`);

  // Test Route 1: POST /api/e/verify (Namespaced E handshake)
  if (req.method === "POST" && (url.pathname === "/api/e/verify" || url.pathname === "/verify")) {
    if (auth !== `Bearer ${expectedKey}`) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Invalid API key" }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "@vxnus/e-test", publisher: "vxnus" }));
    return;
  }

  // Test Route 2: GET /api/openapi.json (OpenAPI auto-discovery)
  if (req.method === "GET" && (url.pathname === "/api/openapi.json" || url.pathname === "/openapi.json")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        openapi: "3.1.0",
        info: { title: "Test Knowledge API", version: "1.0.0" },
        paths: {
          "/api/entities": { get: { summary: "Search test entities" } },
        },
      })
    );
    return;
  }

  // Test Route 3: POST /api/e/retrieve
  if (req.method === "POST" && (url.pathname === "/api/e/retrieve" || url.pathname === "/retrieve")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ revision: "r1", results: [] }));
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ message: "Not found" }));
});

await new Promise((resolve) => server.listen(testPort, resolve));

try {
  const baseUrl = `http://127.0.0.1:${testPort}`;

  // TEST 1: Probe candidate verify paths
  const verifyCandidates = [
    `${baseUrl}/api/e/verify`,
    `${baseUrl}/e/verify`,
    `${baseUrl}/verify`,
  ];

  let verifiedEndpoint = null;
  let verifiedIdentity = null;

  for (const candidate of verifyCandidates) {
    try {
      const res = await fetch(candidate, {
        method: "POST",
        headers: { authorization: `Bearer ${expectedKey}`, "content-type": "application/json" },
        body: "{}",
      });
      if (res.ok) {
        verifiedEndpoint = candidate;
        verifiedIdentity = await res.json();
        break;
      }
    } catch {}
  }

  assert.equal(verifiedEndpoint, `${baseUrl}/api/e/verify`, "Should discover /api/e/verify first");
  assert.equal(verifiedIdentity.id, "@vxnus/e-test");
  assert.equal(verifiedIdentity.publisher, "vxnus");

  // TEST 2: OpenAPI auto-discovery at /api/openapi.json
  const openapiCandidates = [
    `${baseUrl}/api/openapi.json`,
    `${baseUrl}/openapi.json`,
  ];

  let discoveredSpec = null;
  for (const openapiUrl of openapiCandidates) {
    try {
      const res = await fetch(openapiUrl);
      if (res.ok) {
        const spec = await res.json();
        if (spec.openapi && spec.paths && Object.keys(spec.paths).length > 0) {
          discoveredSpec = spec;
          break;
        }
      }
    } catch {}
  }

  assert.ok(discoveredSpec, "Should auto-discover OpenAPI spec");
  assert.equal(discoveredSpec.openapi, "3.1.0");
  assert.ok(discoveredSpec.paths["/api/entities"], "Should contain /api/entities path");

  // TEST 3: Invalid key rejection (401)
  const invalidRes = await fetch(`${baseUrl}/api/e/verify`, {
    method: "POST",
    headers: { authorization: "Bearer invalid_key", "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(invalidRes.status, 401);

  console.log("All Remote Provider Conformance tests passed successfully!");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
