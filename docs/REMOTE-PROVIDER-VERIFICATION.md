# Remote provider verification

This standard applies when the E Knowledge Hub registers a remote E provider. It proves
that a publisher controls both the Hub publisher identity and the provider
behind the public URL.

## Provider contract & endpoints

Every remote provider MUST expose an ownership verification endpoint and at least one accessible knowledge interface:

### 1. Verification Handshake (MANDATORY)
The provider handles the verification handshake at either:
- `POST /api/e/verify` (Standard recommendation)
- `POST /verify` (Direct mount)

```http
POST {baseUrl}/api/e/verify
Authorization: Bearer <publisher-api-key>
Content-Type: application/json
```

The provider returns its canonical public identity:

```json
{
  "id": "@vxnus/e-teyvat",
  "publisher": "vxnus"
}
```

Invalid or missing keys return `401 Unauthorized`; a valid key for a different
provider returns `403 Forbidden`.

### 2. Knowledge Access Interface (MANDATORY)
To prevent publishing closed black boxes, the remote provider MUST support at least one query mechanism:

- **Path A: OpenAPI Contract (Recommended):**
  Host an OpenAPI 3.0/3.1 specification at `GET /api/openapi.json` (or `GET /openapi.json`). E Hub auto-discovers and registers your custom endpoints (`/api/entities`, `/api/farming`, etc.) for AI tool-calling.
- **Path B: Standard E Retrieval:**
  Implement `POST /api/e/retrieve` (or `POST /retrieve`) for cited lexical/semantic search.

### 3. Manifest Endpoint (NOT REQUIRED)
The provider does NOT serve a `GET /manifest` endpoint. Authoritative pack metadata, license, and capability definitions live exclusively in E Hub.

## Base URL discovery

When a publisher enters a Base URL (e.g. `https://eteyvat.vxnus.xyz` or `https://eteyvat.vxnus.xyz/api/e`):
1. E Hub probes verification paths in order: `/api/e/verify`, `/e/verify`, `/verify`.
2. E Hub probes OpenAPI auto-discovery at `/api/openapi.json`, `/openapi.json`.
3. If no OpenAPI contract exists, E Hub probes standard retrieval at `/api/e/retrieve`, `/retrieve`.

## Verification key

The Hub generates a random key in the publisher workspace. Copy the
environment-variable snippet into the provider application:

```bash
E_PUBLISHER_API_KEY=eprov_...
```

The provider keeps this key server-side. The Hub never includes the private key in client bundles or public API responses.

## E-Teyvat Reference Implementation

```text
Server Origin:  https://eteyvat.vxnus.xyz
Provider Mount: https://eteyvat.vxnus.xyz/api/e
OpenAPI Spec:   https://eteyvat.vxnus.xyz/api/openapi.json
Package ID:     @vxnus/e-teyvat
Publisher:      vxnus
```
