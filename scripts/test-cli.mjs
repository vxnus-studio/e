import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const cliPath = join(process.cwd(), "packages/knowledge/bin/e.mjs");

console.log("Running E CLI Test Suite...");

// TEST 1: Version command
const { stdout: versionOut } = await exec("node", [cliPath, "version"]);
assert.match(versionOut, /@vxnus\/e v0\.1\.4/);

// TEST 2: Validate existing fixture
const { stdout: validateOut } = await exec("node", [cliPath, "validate", "packages/knowledge/fixtures/sample"]);
assert.match(validateOut, /Pack is valid and conformant/);

// TEST 3: Inspect existing fixture
const { stdout: inspectOut } = await exec("node", [cliPath, "inspect", "packages/knowledge/fixtures/sample"]);
assert.match(inspectOut, /Knowledge Pack: sample-knowledge/);
assert.match(inspectOut, /Structured Entities: ✓ Yes/);

// TEST 4: Init -> Validate -> Pack -> Inspect pipeline
const workDir = await mkdtemp(join(tmpdir(), "e-cli-test-"));
try {
  const packDir = join(workDir, "my-pack");
  const archivePath = join(workDir, "my-pack.tar.gz");

  // Init
  const { stdout: initOut } = await exec("node", [cliPath, "init", packDir, "--name", "e-cli-test", "--publisher", "testpub"]);
  assert.match(initOut, /Initialized new E knowledge pack/);

  // Validate directory
  const { stdout: valDirOut } = await exec("node", [cliPath, "validate", packDir]);
  assert.match(valDirOut, /@testpub\/e-cli-test/);

  // Pack archive
  const { stdout: packOut } = await exec("node", [cliPath, "pack", packDir, "--out", archivePath]);
  assert.match(packOut, /Pack archive created successfully/);

  // Inspect archive
  const { stdout: insArchOut } = await exec("node", [cliPath, "inspect", archivePath]);
  assert.match(insArchOut, /Archive SHA:/);
  assert.match(insArchOut, /@testpub\/e-cli-test/);
} finally {
  await rm(workDir, { recursive: true, force: true }).catch(() => {});
}

console.log("All E CLI tests passed successfully!");
