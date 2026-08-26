import { timingSafeEqual } from "node:crypto";
import type { KnowledgePackManifest, KnowledgeProvider, RetrievalRequest, RetrievalResponse } from "@vxnus/e";
import { validateManifest, validateRetrievalRequest, validateRetrievalResponse } from "@vxnus/e";

export interface ProviderIdentity {
  id: string;
  publisher: string;
}

export interface ProviderVerificationResult {
  status: 200 | 401 | 403;
  body: ProviderIdentity | { error: "unauthorized" | "forbidden" };
}

export interface KnowledgeProviderConfig {
  verificationKey: string;
  identity?: ProviderIdentity;
  manifest?: KnowledgePackManifest;
  retrieve?(request: RetrievalRequest): Promise<RetrievalResponse> | RetrievalResponse;
}

export interface KnowledgeProviderHandlers {
  manifest?: (() => KnowledgePackManifest) | undefined;
  retrieve?: ((request: unknown) => Promise<RetrievalResponse>) | undefined;
  verify: (authorization?: string) => ProviderVerificationResult;
}

export interface EKnowledgeProvider extends KnowledgeProvider {
  handlers: KnowledgeProviderHandlers;
  identity?: ProviderIdentity | undefined;
}

function matchesKey(provided: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const providedBytes = encoder.encode(provided);
  const expectedBytes = encoder.encode(expected);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

function bearerToken(authorization?: string): string | undefined {
  if (!authorization) return undefined;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

export function createKnowledgeProvider(config: KnowledgeProviderConfig): EKnowledgeProvider {
  if (!config.verificationKey || !config.verificationKey.trim()) {
    throw new Error("verificationKey must be a non-empty server-side secret");
  }
  const manifest = config.manifest ? validateManifest(config.manifest) : undefined;
  const identity: ProviderIdentity = config.identity ?? (manifest ? { id: manifest.id, publisher: manifest.publisher } : { id: "unknown", publisher: "unknown" });

  const handlers: KnowledgeProviderHandlers = {
    manifest: manifest ? () => manifest : undefined,
    retrieve: config.retrieve ? async (input) => {
      const request = validateRetrievalRequest(input);
      if (manifest && request.mode === "semantic" && !manifest.capabilities.semanticSearch) {
        throw new Error("retrieval mode 'semantic' is not supported");
      }
      if (manifest && request.mode === "hybrid" && (!manifest.capabilities.lexicalSearch || !manifest.capabilities.semanticSearch)) {
        throw new Error("retrieval mode 'hybrid' is not supported");
      }
      const response = await config.retrieve!(request);
      return validateRetrievalResponse(response, manifest);
    } : undefined,
    verify: (authorization) => {
      const token = bearerToken(authorization);
      if (!token || !matchesKey(token, config.verificationKey)) return { status: 401, body: { error: "unauthorized" } };
      return { status: 200, body: identity };
    },
  };

  return {
    manifest: handlers.manifest,
    retrieve: handlers.retrieve,
    handlers,
    identity,
  };
}
