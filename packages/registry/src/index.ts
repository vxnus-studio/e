import type { JsonObject, KnowledgePackManifest } from "@vxnus/e";

export interface RegistryPack extends KnowledgePackManifest {
  publisherId: string;
  distribution: RegistryDistribution;
  verified: boolean;
  apiContract?: JsonObject;
}

export interface RegistryDistribution {
  kind: "archive" | "provider";
  url: string;
  checksum?: string;
}

export interface RegistrySearchRequest {
  query?: string;
  publisherId?: string;
  limit?: number;
  cursor?: string;
}

export interface RegistrySearchResponse {
  packs: RegistryPack[];
  nextCursor?: string;
}

export interface KnowledgeRegistry {
  search(request: RegistrySearchRequest): Promise<RegistrySearchResponse>;
  get(packId: string, version?: string): Promise<RegistryPack | undefined>;
}
