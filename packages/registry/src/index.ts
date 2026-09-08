import type { JsonObject, KnowledgePackManifest } from "@vxnus/e";

export type KnowledgeDistributionType = "local" | "remote" | "both";

export interface RegistryDistribution {
  kind: "archive" | "provider";
  url: string;
  checksum?: string;
}

export function resolveDistributionType(
  distributions?: RegistryDistribution[] | RegistryDistribution
): KnowledgeDistributionType {
  if (!distributions) return "local";
  const list = Array.isArray(distributions) ? distributions : [distributions];
  const hasArchive = list.some((d) => d.kind === "archive");
  const hasProvider = list.some((d) => d.kind === "provider");
  if (hasArchive && hasProvider) return "both";
  if (hasProvider) return "remote";
  return "local";
}

export interface RegistryPack extends KnowledgePackManifest {
  publisherId: string;
  distributionType: KnowledgeDistributionType;
  distribution: RegistryDistribution;
  distributions?: RegistryDistribution[];
  verified: boolean;
  apiContract?: JsonObject;
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
