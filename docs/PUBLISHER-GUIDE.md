# E publisher guide

An E knowledge pack is a portable directory validated at the publishing
boundary. Keep source acquisition and normalization in the publisher’s own
repository; E stores only the resulting public pack contract.

## 1. Build the directory

Create `manifest.json` plus `sources/`, `documents/`, `chunks/`, `entities/`,
`relations/`, and `revisions/` directories. Every record needs a stable `id`.
The manifest should declare the project license (`license`, `licenseName`, and
`licenseUrl`) plus optional rights-holder, copyright, attribution, and notice
text. Sources should repeat their own license identifier and human-readable
description when needed. Documents reference sources and revisions; chunks reference documents;
relations reference existing entities.

Use the E types and the reference fixture in
`@vxnus/e-knowledge/fixtures/sample` as the compatibility baseline. Keep
citations tied to the source record that supports the text.

## 2. Create a revision

Hash the sorted source, document, chunk, entity, and relation records using the
same stable serialization as `loadPack`. Write that SHA-256 as
`revisions/<id>.json` `contentHash`. A revision is immutable: publish a new
revision when public content changes.

## 3. Validate locally

```bash
npx @vxnus/e-knowledge ./pack
```

Then test retrieval with a cited result. Start with
`lexicalSearch: true`; advertise semantic search only when the embedding index
and provider are complete. Never put API keys or database URLs in a manifest,
pack record, citation, or retrieval response.

## 4. Publish

Archive the pack without changing record bytes, calculate the archive SHA-256,
and publish the archive and manifest together. A registry entry should retain
the package ID (`@publisher/name`), semantic version, revision, source metadata,
capabilities, distribution URL, and archive checksum.

For a remote provider, publish the provider URL instead of an archive and
follow [Remote provider verification](./REMOTE-PROVIDER-VERIFICATION.md). The
provider URL is public for consumers; its verification key is used only by the
Hub to prove publisher control.
