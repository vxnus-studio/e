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

The Hub generates a long random key in the publisher workspace. Copy the
one-time environment-variable snippet into the provider application. The key
remains only in the browser until verification; the Hub does not store or log
it. The provider keeps it server-side and must never expose it.

The Hub verifies ownership with:

```http
POST {provider-url}/verify
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

Keys use HTTPS and are registration-scoped. Generate a replacement key when
rotating or re-verifying a provider. After successful registration, the Hub has
no secret to delete: only the provider environment retains the key, while the
Hub keeps the public URL, verification timestamp, and provider identity.

## E-Teyvat

```text
Provider URL: https://eteyvat.vxnus.xyz/api/e
Package ID:   @vxnus/e-teyvat
Publisher:    vxnus
```

E-Teyvat remains publicly readable. Its verification key is used only by the
Hub to establish publisher control during registration.
