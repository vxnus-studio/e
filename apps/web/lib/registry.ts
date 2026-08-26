import type { KnowledgeRegistry, RegistryPack, RegistrySearchRequest, RegistrySearchResponse } from "@vxnus/e-registry";
import { createSupabaseRegistry, isSupabaseRegistryConfigured } from "./supabase-registry";

export const staticRegistry: KnowledgeRegistry = {
  async search(request: RegistrySearchRequest): Promise<RegistrySearchResponse> {
    return { packs: [] };
  },
  async get(packId: string, version?: string) {
    return undefined;
  },
};

// Use the database registry when configured; otherwise use empty static registry.
const remoteRegistry = isSupabaseRegistryConfigured() ? createSupabaseRegistry() : undefined;
export const registry: KnowledgeRegistry = remoteRegistry ?? staticRegistry;

