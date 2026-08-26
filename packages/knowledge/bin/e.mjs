#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { loadPack } from "../dist/index.js";

const exec = promisify(execFile);

const HELP = `
E Knowledge Protocol CLI

Usage:
  e <command> [options] [arguments]

Commands:
  validate <dir|archive>           Validate an E knowledge pack directory or .tar.gz archive
  inspect  <dir|archive>           Inspect pack metadata, sources, license, and capabilities
  pack     <dir> [--out <file>]    Validate and package a directory into an immutable .tar.gz
  verify-provider <url> <key>      Verify a remote provider endpoint and publisher handshake
  init     <dir>                   Scaffold a new conformant E pack directory structure
  version                          Print CLI and package version

Examples:
  e validate ./my-pack
  e inspect ./my-pack.tar.gz
  e pack ./my-pack --out ./dist/my-pack.1.0.0.tar.gz
  e verify-provider https://eteyvat.vxnus.xyz/api/e eprov_secret_key_123
  e init ./new-pack --name teyvat --publisher vxnus
`.trim();

async function extractArchive(archivePath) {
  const tempDir = await mkdtemp(join(tmpdir(), "e-cli-extract-"));
  await exec("tar", ["-xzf", resolve(archivePath), "-C", tempDir]);
  return tempDir;
}

async function isArchive(path) {
  return path.endsWith(".tar.gz") || path.endsWith(".tgz");
}

async function handleValidate(target) {
  if (!target) {
    console.error("Error: pack directory or archive path is required.");
    console.error("Usage: e validate <dir|archive>");
    process.exit(1);
  }

  let cleanUpDir = null;
  let packDir = resolve(target);

  try {
    if (await isArchive(target)) {
      cleanUpDir = await extractArchive(target);
      packDir = cleanUpDir;
    }

    const pack = await loadPack(packDir);
    console.log("✓ Pack is valid and conformant with E Protocol specification.");
    console.log(JSON.stringify({
      id: pack.manifest.id,
      publisher: pack.manifest.publisher,
      version: pack.manifest.version,
      schemaVersion: pack.manifest.schemaVersion,
      revision: pack.revision.id,
      sources: pack.sources.length,
      documents: pack.documents.length,
      chunks: pack.chunks.length,
      entities: pack.entities.length,
      relations: pack.relations.length,
      capabilities: pack.manifest.capabilities,
    }, null, 2));
  } catch (error) {
    console.error(`✗ Validation failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  } finally {
    if (cleanUpDir) await rm(cleanUpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function handleInspect(target) {
  if (!target) {
    console.error("Error: pack directory or archive path is required.");
    console.error("Usage: e inspect <dir|archive>");
    process.exit(1);
  }

  let cleanUpDir = null;
  let packDir = resolve(target);

  try {
    let archiveChecksum = null;
    if (await isArchive(target)) {
      const bytes = await readFile(resolve(target));
      archiveChecksum = createHash("sha256").update(bytes).digest("hex");
      cleanUpDir = await extractArchive(target);
      packDir = cleanUpDir;
    }

    const pack = await loadPack(packDir);
    console.log(`\n📦 Knowledge Pack: ${pack.manifest.id} (v${pack.manifest.version})`);
    console.log(`────────────────────────────────────────`);
    console.log(`Publisher:     @${pack.manifest.publisher}`);
    console.log(`Schema:        v${pack.manifest.schemaVersion}`);
    console.log(`Description:   ${pack.manifest.description || "—"}`);
    if (pack.manifest.license) {
      console.log(`License:       ${pack.manifest.license.license} (${pack.manifest.license.licenseName})`);
      if (pack.manifest.license.rightsHolder) console.log(`Rights Holder: ${pack.manifest.license.rightsHolder}`);
    }
    if (archiveChecksum) {
      console.log(`Archive SHA:   ${archiveChecksum}`);
    }
    console.log(`\n📚 Sources (${pack.sources.length}):`);
    for (const src of pack.sources) {
      console.log(`  • [${src.id}] ${src.title} (License: ${src.license}${src.uri ? `, URI: ${src.uri}` : ""})`);
    }
    console.log(`\n⚡ Capabilities:`);
    console.log(`  • Structured Entities: ${pack.manifest.capabilities.structuredEntities ? "✓ Yes" : "✗ No"} (${pack.entities.length} entities, ${pack.relations.length} relations)`);
    console.log(`  • Lexical Search:      ${pack.manifest.capabilities.lexicalSearch ? "✓ Yes" : "✗ No"} (${pack.chunks.length} chunks)`);
    console.log(`  • Semantic Search:     ${pack.manifest.capabilities.semanticSearch ? "✓ Yes" : "✗ No"}`);
    console.log(`  • Revisions:           ${pack.manifest.capabilities.revisions ? "✓ Yes" : "✗ No"} (Active: ${pack.revision.id})`);
    console.log(``);
  } catch (error) {
    console.error(`✗ Inspection failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  } finally {
    if (cleanUpDir) await rm(cleanUpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function handlePack(dir, args) {
  if (!dir) {
    console.error("Error: pack directory is required.");
    console.error("Usage: e pack <dir> [--out <output.tar.gz>]");
    process.exit(1);
  }

  const packDir = resolve(dir);
  let outIndex = args.indexOf("--out");
  let outFile = outIndex !== -1 && args[outIndex + 1] ? resolve(args[outIndex + 1]) : null;

  try {
    const pack = await loadPack(packDir);
    if (!outFile) {
      const sanitizedId = pack.manifest.id.replace(/[@/]/g, "-").replace(/^-+/, "");
      outFile = resolve(process.cwd(), `${sanitizedId}-${pack.manifest.version}.tar.gz`);
    }

    await mkdir(dirname(outFile), { recursive: true });
    await exec("tar", ["-czf", outFile, "-C", packDir, "."]);

    const bytes = await readFile(outFile);
    const checksum = createHash("sha256").update(bytes).digest("hex");

    console.log(`✓ Pack archive created successfully.`);
    console.log(`Archive:  ${outFile}`);
    console.log(`Size:     ${(bytes.length / 1024).toFixed(2)} KB`);
    console.log(`SHA-256:  ${checksum}`);
  } catch (error) {
    console.error(`✗ Packaging failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

async function handleVerifyProvider(url, apiKey) {
  if (!url || !apiKey) {
    console.error("Error: provider URL and API key are required.");
    console.error("Usage: e verify-provider <url> <api-key>");
    process.exit(1);
  }

  const providerUrl = url.replace(/\/+$/, "");
  console.log(`Connecting to ${providerUrl}/verify ...`);

  try {
    const res = await fetch(`${providerUrl}/verify`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: "{}",
    });

    if (res.status === 401) {
      console.error(`✗ Handshake failed: 401 Unauthorized (Invalid provider API key)`);
      process.exit(1);
    }
    if (res.status === 403) {
      console.error(`✗ Handshake failed: 403 Forbidden (Key belongs to different provider)`);
      process.exit(1);
    }
    if (!res.ok) {
      console.error(`✗ Handshake failed: HTTP ${res.status}`);
      process.exit(1);
    }

    const identity = await res.json();
    console.log(`✓ Provider verification successful!`);
    console.log(`Provider Identity: ${identity.id} (@${identity.publisher})`);
    console.log(`Conformant:        POST /verify responds with valid E publisher identity.`);
  } catch (error) {
    console.error(`✗ Verification request failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

async function handleInit(dir, args) {
  if (!dir) {
    console.error("Error: directory path is required.");
    console.error("Usage: e init <dir> [--name <name>] [--publisher <publisher>]");
    process.exit(1);
  }

  const targetDir = resolve(dir);
  let name = "sample";
  let publisher = "acme";

  const nameIdx = args.indexOf("--name");
  if (nameIdx !== -1 && args[nameIdx + 1]) name = args[nameIdx + 1];
  const pubIdx = args.indexOf("--publisher");
  if (pubIdx !== -1 && args[pubIdx + 1]) publisher = args[pubIdx + 1];

  const packageId = `@${publisher}/${name}`;

  try {
    await mkdir(join(targetDir, "sources"), { recursive: true });
    await mkdir(join(targetDir, "documents"), { recursive: true });
    await mkdir(join(targetDir, "chunks"), { recursive: true });
    await mkdir(join(targetDir, "entities"), { recursive: true });
    await mkdir(join(targetDir, "relations"), { recursive: true });
    await mkdir(join(targetDir, "revisions"), { recursive: true });

    const manifest = {
      id: packageId,
      name,
      publisher,
      version: "1.0.0",
      schemaVersion: "1.0",
      description: `${name} knowledge pack`,
      license: {
        license: "CC-BY-4.0",
        licenseName: "Creative Commons Attribution 4.0 International",
        licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
        rightsHolder: publisher,
      },
      sources: [{ id: "main-source", title: `${name} handbook`, license: "CC-BY-4.0" }],
      capabilities: {
        lexicalSearch: true,
        semanticSearch: false,
        structuredEntities: true,
        relations: true,
        revisions: true,
      },
    };

    const source = { id: "main-source", title: `${name} handbook`, license: "CC-BY-4.0" };
    const doc = { id: "intro", sourceId: "main-source", content: "Welcome to the knowledge base.", revision: "r1" };
    const chunk = { id: "intro-1", documentId: "intro", content: "Welcome to the knowledge base.", ordinal: 0 };
    const entity = { id: "main-topic", kind: "Topic", name: name };
    const relation = { id: "rel-1", subjectId: "main-topic", objectId: "main-topic", kind: "related" };

    const stableContent = (val) => {
      if (Array.isArray(val)) return `[${val.map(stableContent).join(",")}]`;
      if (typeof val === "object" && val !== null) return `{${Object.keys(val).sort().map(k => `${JSON.stringify(k)}:${stableContent(val[k])}`).join(",")}}`;
      return JSON.stringify(val);
    };
    const contentHash = createHash("sha256").update(stableContent([[source], [doc], [chunk], [entity], [relation]])).digest("hex");

    const revision = { id: "r1", createdAt: new Date().toISOString(), contentHash };

    await writeFile(join(targetDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    await writeFile(join(targetDir, "sources", "main.json"), JSON.stringify(source, null, 2) + "\n");
    await writeFile(join(targetDir, "documents", "intro.json"), JSON.stringify(doc, null, 2) + "\n");
    await writeFile(join(targetDir, "chunks", "intro-1.json"), JSON.stringify(chunk, null, 2) + "\n");
    await writeFile(join(targetDir, "entities", "topic.json"), JSON.stringify(entity, null, 2) + "\n");
    await writeFile(join(targetDir, "relations", "rel.json"), JSON.stringify(relation, null, 2) + "\n");
    await writeFile(join(targetDir, "revisions", "r1.json"), JSON.stringify(revision, null, 2) + "\n");

    console.log(`✓ Initialized new E knowledge pack in ${targetDir}`);
    console.log(`Package ID: ${packageId}`);
    console.log(`Run 'e validate ${dir}' to test.`);
  } catch (error) {
    console.error(`✗ Init failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

async function main() {
  const [,, cmd, ...args] = process.argv;

  switch (cmd) {
    case "validate":
      await handleValidate(args[0]);
      break;
    case "inspect":
      await handleInspect(args[0]);
      break;
    case "pack":
      await handlePack(args[0], args.slice(1));
      break;
    case "verify-provider":
      await handleVerifyProvider(args[0], args[1]);
      break;
    case "init":
      await handleInit(args[0], args.slice(1));
      break;
    case "version":
    case "-v":
    case "--version":
      console.log("@vxnus/e v0.1.4");
      break;
    case "help":
    case "-h":
    case "--help":
    case undefined:
      console.log(HELP);
      break;
    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
