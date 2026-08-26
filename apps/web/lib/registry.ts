import type { KnowledgeRegistry, RegistryPack, RegistrySearchRequest, RegistrySearchResponse } from "@vxnus/e-registry";
import { createSupabaseRegistry, isSupabaseRegistryConfigured } from "./supabase-registry";

const packs: RegistryPack[] = [
  {
    id: "@vxnus/e-teyvat",
    name: "e-teyvat",
    publisher: "vxnus",
    version: "1.0.1",
    schemaVersion: "1.0",
    description: "Structured Genshin Impact knowledge.",
    license: { license: "CC-BY-4.0", licenseName: "Creative Commons Attribution 4.0 International", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", rightsHolder: "vxnus", copyrightNotice: "© 2026 vxnus", attributionText: "E-Teyvat by vxnus", notice: "E-Teyvat is an unofficial fan project and is not affiliated with, endorsed by, or sponsored by HoYoverse. This license applies only to original material contributed to E-Teyvat and does not grant, transfer, or imply any license or permission to use Genshin Impact or other third-party intellectual property. Users are responsible for ensuring that their use of third-party intellectual property complies with applicable rights, licenses, and terms." },
    sources: [{ id: "e-teyvat", title: "E-Teyvat", license: "CC-BY-4.0", licenseDescription: "Creative Commons Attribution 4.0 International", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", uri: "https://github.com/vxnuslabs/e-teyvat" }],
    capabilities: { lexicalSearch: true, semanticSearch: true, structuredEntities: true, relations: true, revisions: true },
    retrieval: {
      embedding: {
        model: "text-embedding-3-small",
        dimensions: 1536,
        provider: "openai"
      }
    },
    publisherId: "vxnus",
    verified: false,
    distribution: { kind: "provider", url: "https://eteyvat.vxnus.xyz/api/e" },
    apiContract: {
      openapi: "3.1.0",
      info: { title: "E-Teyvat Knowledge API", version: "1.0.0" },
      paths: {
        "/api/entities": { get: { summary: "List or search entities" } },
        "/api/knowledge/search": { get: { summary: "Keyword search" } },
        "/api/farming": { get: { summary: "Farming sources" } }
      }
    }
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

// Use the static catalog only when the database registry is not configured.
const remoteRegistry = isSupabaseRegistryConfigured() ? createSupabaseRegistry() : undefined;
export const registry: KnowledgeRegistry = remoteRegistry ?? staticRegistry;
