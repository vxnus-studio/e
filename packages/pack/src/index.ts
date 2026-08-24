import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { KnowledgePackManifest, KnowledgeProvider, PackChunk, PackDocument, PackEntity, PackRelation, PackRevision, PackSource, RetrievalRequest, RetrievalResponse, RetrievalResult } from "@vxnus/e";
import { validateManifest, validateRetrievalRequest, validateRetrievalResponse } from "@vxnus/e";

export interface LoadedPack {
  manifest: KnowledgePackManifest;
  revision: PackRevision;
  sources: PackSource[];
  documents: PackDocument[];
  chunks: PackChunk[];
  entities: PackEntity[];
  relations: PackRelation[];
  provider: KnowledgeProvider;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const parse = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8"));
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};
const digest = (records: unknown[]) => createHash("sha256").update(stable(records)).digest("hex");

async function readRecords<T>(root: string, directory: string): Promise<T[]> {
  let names: string[];
  try { names = (await readdir(join(root, directory))).filter(name => name.endsWith(".json")).sort(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  return Promise.all(names.map(name => parse(join(root, directory, name)) as Promise<T>));
}

function uniqueIds(records: Array<{ id: string }>, label: string) {
  const ids = new Set<string>();
  for (const record of records) {
    if (!isRecord(record) || typeof record.id !== "string" || record.id.length === 0) throw new Error(`${label} records require a non-empty id`);
    if (ids.has(record.id)) throw new Error(`${label} id is duplicated: ${record.id}`);
    ids.add(record.id);
  }
}

function validateRecords(sources: PackSource[], documents: PackDocument[], chunks: PackChunk[], entities: PackEntity[], relations: PackRelation[], revisions: PackRevision[]) {
  uniqueIds(sources, "source"); uniqueIds(documents, "document"); uniqueIds(chunks, "chunk"); uniqueIds(entities, "entity"); uniqueIds(relations, "relation"); uniqueIds(revisions, "revision");
  const sourceIds = new Set(sources.map(item => item.id));
  const documentIds = new Set(documents.map(item => item.id));
  const entityIds = new Set(entities.map(item => item.id));
  const revisionIds = new Set(revisions.map(item => item.id));
  for (const document of documents) { if (!sourceIds.has(document.sourceId)) throw new Error(`document ${document.id} references missing source ${document.sourceId}`); }
  for (const chunk of chunks) { if (!documentIds.has(chunk.documentId)) throw new Error(`chunk ${chunk.id} references missing document ${chunk.documentId}`); }
  for (const relation of relations) {
    if (!entityIds.has(relation.subjectId)) throw new Error(`relation ${relation.id} references missing subject ${relation.subjectId}`);
    if (!entityIds.has(relation.objectId)) throw new Error(`relation ${relation.id} references missing object ${relation.objectId}`);
  }
  for (const document of documents) if (!revisionIds.has(document.revision)) throw new Error(`document ${document.id} references missing revision ${document.revision}`);
}

export async function loadPack(root: string): Promise<LoadedPack> {
  const manifest = validateManifest(await parse(join(root, "manifest.json")));
  const sources = await readRecords<PackSource>(root, "sources");
  const documents = await readRecords<PackDocument>(root, "documents");
  const chunks = await readRecords<PackChunk>(root, "chunks");
  const entities = await readRecords<PackEntity>(root, "entities");
  const relations = await readRecords<PackRelation>(root, "relations");
  const revisions = await readRecords<PackRevision>(root, "revisions");
  validateRecords(sources, documents, chunks, entities, relations, revisions);
  const revision = revisions.at(-1);
  if (!revision) throw new Error("pack must contain at least one revision");
  if (manifest.capabilities.revisions && !revision.contentHash) throw new Error(`revision ${revision.id} must declare contentHash`);
  const contentHash = digest([sources, documents, chunks, entities, relations]);
  if (revision.contentHash && revision.contentHash !== contentHash) throw new Error(`revision ${revision.id} contentHash does not match pack contents`);
  const provider: KnowledgeProvider = {
    manifest: () => manifest,
    retrieve: async (request: RetrievalRequest): Promise<RetrievalResponse> => {
      validateRetrievalRequest(request);
      const limit = request.limit ?? 10;
      if (request.mode && request.mode !== "lexical") throw new Error(`retrieval mode '${request.mode}' is not supported`);
      if (request.revision && request.revision !== revision.id) throw new Error(`revision not found: ${request.revision}`);
      const query = request.query.toLocaleLowerCase();
      const results: RetrievalResult[] = chunks.filter(chunk => chunk.content.toLocaleLowerCase().includes(query)).sort((a, b) => a.id.localeCompare(b.id)).slice(0, limit).map(chunk => {
        const document = documents.find(item => item.id === chunk.documentId)!;
        return { id: chunk.id, content: chunk.content, revision: revision.id, citations: [{ sourceId: document.sourceId, documentId: document.id, chunkId: chunk.id }] };
      });
      const response = { results, revision: revision.id, ...(results.length < chunks.filter(chunk => chunk.content.toLocaleLowerCase().includes(query)).length ? { partial: true } : {}) };
      return validateRetrievalResponse(response, manifest);
    }
  };
  return { manifest, revision, sources, documents, chunks, entities, relations, provider };
}
