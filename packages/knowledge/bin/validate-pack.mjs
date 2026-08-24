#!/usr/bin/env node
import { resolve } from "node:path";
import { loadPack } from "../dist/index.js";

const directory = process.argv[2];
if (!directory || process.argv.length > 3) {
  console.error("Usage: e-knowledge-validate <pack-directory>");
  process.exitCode = 2;
} else {
  try {
    const pack = await loadPack(resolve(directory));
    console.log(JSON.stringify({ id: pack.manifest.id, version: pack.manifest.version, revision: pack.revision.id, sources: pack.sources.length, documents: pack.documents.length, chunks: pack.chunks.length, entities: pack.entities.length, relations: pack.relations.length }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
