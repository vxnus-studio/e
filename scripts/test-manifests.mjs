import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ManifestValidationError, validateManifest } from "../packages/protocol/dist/index.js";

const fixture = async name => JSON.parse(await readFile(new URL(`../packages/protocol/fixtures/${name}`, import.meta.url), "utf8"));
validateManifest(await fixture("manifest.valid.json"));
for (const name of ["manifest.invalid-unknown-field.json", "manifest.invalid-capability.json", "manifest.invalid-source.json"]) {
  const value = await fixture(name);
  assert.throws(() => validateManifest(value), ManifestValidationError);
}
console.log("Manifest fixtures passed.");
