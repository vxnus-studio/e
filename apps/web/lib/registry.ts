import type { KnowledgeRegistry, RegistryPack, RegistrySearchRequest, RegistrySearchResponse } from "@vxnus/e-registry";
import { createSupabaseRegistry, isSupabaseRegistryConfigured } from "./supabase-registry";

const packs: RegistryPack[] = [
  {
    id: "@vxnus/teyvat",
    name: "Teyvat Genshin Knowledge Base",
    publisher: "vxnuslabs",
    version: "1.0.0",
    schemaVersion: "1.0",
    description: "Structured Genshin Impact knowledge from the normalized gi-data projection.",
    sources: [{ id: "gi-data", title: "gi-data", license: "see source metadata", uri: "https://github.com/vxnuslabs/gi-data" }],
    capabilities: { lexicalSearch: true, semanticSearch: false, structuredEntities: true, relations: true, revisions: true },
    publisherId: "vxnuslabs",
    verified: false,
    distribution: { kind: "provider", url: "https://eteyvat.vxnus.xyz/api/knowledge" },
  },
  {
    id: "@vxnus/siduri-basics",
    name: "Siduri Basics",
    publisher: "vxnuslabs",
    version: "0.1.0",
    schemaVersion: "1.0",
    description: "A tiny knowledge pack used to verify Siduri installation.",
    sources: [{ id: "siduri-handbook", title: "Siduri Handbook", license: "CC0-1.0" }],
    capabilities: { lexicalSearch: true, semanticSearch: false, structuredEntities: false, relations: false, revisions: true },
    publisherId: "vxnuslabs",
    verified: true,
    distribution: { kind: "archive", url: "https://knowledge.e.vxnus.xyz/@vxnus/siduri-basics/0.1.0.tar.gz", checksum: "5ec9107e12877b494d2a9fd1de82cb131d8cdb2492b50539eb395f7926df6f42" },
  },
];

export const staticRegistry: KnowledgeRegistry = {
  async search(request: RegistrySearchRequest): Promise<RegistrySearchResponse> {
    const query = request.query?.trim().toLowerCase();
    const filtered = packs.filter((pack) => !query || [pack.id, pack.name, pack.publisher, pack.description].some((value) => value?.toLowerCase().includes(query)));
    const limit = Math.min(Math.max(request.limit ?? 20, 1), 100);
    return { packs: filtered.slice(0, limit) };
  },
  async get(packId: string, version?: string) {
    return packs.find((pack) => pack.id === packId && (!version || pack.version === version));
  },
};

export { packs };

// Supabase is authoritative once configured. Static metadata is only used when
// the control plane is unavailable during local development.
const remoteRegistry = isSupabaseRegistryConfigured() ? createSupabaseRegistry() : undefined;
export const registry: KnowledgeRegistry = remoteRegistry ?? staticRegistry;
