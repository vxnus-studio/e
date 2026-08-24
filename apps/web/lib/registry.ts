import type { KnowledgeRegistry, RegistryPack, RegistrySearchRequest, RegistrySearchResponse } from "@vxnus/e-registry";

const packs: RegistryPack[] = [
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
    distribution: { kind: "archive", url: "https://hub.vxnuslabs.com/packs/@vxnus/siduri-basics/-/siduri-basics-0.1.0.tar.gz", checksum: "db6338c160c3691c82bb6f7dcca078fcbe9dddb51512aff06c5a73f777a75386" },
  },
];

export const registry: KnowledgeRegistry = {
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
