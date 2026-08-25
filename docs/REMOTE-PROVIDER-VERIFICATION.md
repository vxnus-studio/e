# Remote provider verification

This standard applies when the Hub registers a remote E provider. It proves
that a publisher controls both the Hub publisher identity and the provider
behind the public URL.

## Provider endpoints

Every remote provider exposes these endpoints below its registered base URL:

```text
GET  /manifest
POST /retrieve
POST /verify
```

`/manifest` and `/retrieve` are public. Siduri and other consumers do not need
credentials to read a published provider.

## Verification key

The publisher creates a long random key in the provider application and keeps it
server-side, for example as `E_PUBLISHER_API_KEY`. The provider must never return
this key from any endpoint.

The Hub verifies ownership with:

```http
POST {provider-url}/verify
Authorization: Bearer <publisher-api-key>
Content-Type: application/json
```

The provider returns its canonical public identity:

```json
{
  "id": "@vxnus/teyvat",
  "publisher": "vxnuslabs"
}
```

Invalid or missing keys return `401 Unauthorized`; a valid key for a different
provider returns `403 Forbidden`.

## Hub registration rules

The Hub accepts a remote release only when the signed-in account owns the
publisher ID, provider verification succeeds, the provider identity matches the
manifest, the package/version is not already registered, and the normalized
provider URL is not already registered by another release.

If a provider does not declare source metadata, the Hub records:

```json
{ "id": "unknown", "title": "unknown", "license": "unknown" }
```

The Hub stores only the public provider URL and verification state. It never
sends the verification key to Siduri or includes it in registry responses.

## Key lifecycle

Keys must use HTTPS and support rotation and revocation. The Hub must not log
keys. If re-verification is required, store the key only in a server-side
secret manager; otherwise discard it after registration and retain only the
verification timestamp and provider identity.

## E-Teyvat

```text
Provider URL: https://eteyvat.vxnus.xyz/api/knowledge
Package ID:   @vxnus/teyvat
Publisher:    vxnuslabs
```

E-Teyvat remains publicly readable. Its verification key is used only by the
Hub to establish publisher control during registration.
