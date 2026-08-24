import type { KnowledgePackManifest, KnowledgeProvider, RetrievalRequest, RetrievalResponse } from "@vxnus/e";
import type { KnowledgeRegistry, RegistryPack, RegistrySearchRequest, RegistrySearchResponse } from "@vxnus/e-registry";

export interface RegistryTransport {
  search(request: RegistrySearchRequest): Promise<RegistrySearchResponse>;
  get(packId: string, version?: string): Promise<RegistryPack | undefined>;
}

export class RegistryClient implements KnowledgeRegistry {
  constructor(private readonly transport: RegistryTransport) {}

  search(request: RegistrySearchRequest) { return this.transport.search(request); }
  get(packId: string, version?: string) { return this.transport.get(packId, version); }
}

export interface ProviderTransport {
  manifest(): Promise<KnowledgePackManifest>;
  retrieve(request: RetrievalRequest): Promise<RetrievalResponse>;
}

export class RemoteKnowledgeProvider implements KnowledgeProvider {
  constructor(private readonly transport: ProviderTransport) {}

  manifest() { return this.transport.manifest(); }
  retrieve(request: RetrievalRequest) { return this.transport.retrieve(request); }
}
