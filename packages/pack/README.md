# @vxnus/e-pack

Filesystem knowledge packs for E. A pack is portable, self-contained, and
validated before it is exposed as a `KnowledgeProvider`.

## Layout

```text
pack/
├── manifest.json
├── revisions/<revision-id>.json
├── sources/<source-id>.json
├── documents/<document-id>.json
├── chunks/<chunk-id>.json
├── entities/<entity-id>.json
└── relations/<relation-id>.json
```

`loadPack(directory)` validates every record, checks references, verifies the
declared revision hash, and returns a local lexical provider.

The sample pack under `fixtures/sample/` is the reference directory layout.
Its revision hash covers sorted source, document, chunk, entity, and relation
records using SHA-256. The manifest must advertise `revisions: true` when a
hash is required.
