# E release checklist

- [ ] `manifest.json` validates with `validateManifest`.
- [ ] All records have unique IDs and valid references.
- [ ] Revision content hash matches the pack contents.
- [ ] Sources include license and public provenance.
- [ ] Retrieval results contain citations and one revision.
- [ ] Semantic capability is false unless its index is complete and tested.
- [ ] No secrets, database URLs, or private source material are packaged.
- [ ] Archive checksum is calculated from the final immutable bytes.
- [ ] The registry distribution URL and checksum match the published archive.
- [ ] Remote distributions pass provider verification before registration.
- [ ] Remote provider keys are never included in manifests, logs, or responses.
- [ ] Duplicate package/version insertion is rejected without orphan files.
- [ ] `npm test`, package build, and the hosted smoke check pass where
  deployment is in scope.
