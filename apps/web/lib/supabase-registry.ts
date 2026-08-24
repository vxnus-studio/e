import "server-only";
import type { KnowledgeRegistry, RegistryPack, RegistrySearchRequest, RegistrySearchResponse } from "@vxnus/e-registry";

type RegistryRow = RegistryPack;
function settings() { const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY; return url && key ? { url: url.replace(/\/$/, ""), key } : null; }
async function request<T>(path: string, init?: RequestInit): Promise<{ status: number; data: T }> {
  const config = settings(); if (!config) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  const response = await fetch(`${config.url}/rest/v1/${path}`, { ...init, headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, "Content-Type": "application/json", Prefer: "return=representation", ...init?.headers }, cache: "no-store" });
  const data = await response.json().catch(() => null) as T;
  return { status: response.status, data };
}
export function isSupabaseRegistryConfigured() { return settings() !== null; }
export async function insertRegistryPack(pack: RegistryPack, publisherId: string) {
  const result = await request<RegistryRow[]>("registry_packs", { method: "POST", body: JSON.stringify({ package_id: pack.id, name: pack.name, publisher: pack.publisher, version: pack.version, schema_version: pack.schemaVersion, description: pack.description || null, sources: pack.sources, capabilities: pack.capabilities, publisher_id: publisherId, distribution: pack.distribution, verified: pack.verified }) });
  if (result.status === 409) { const error = new Error("That package version already exists."); error.name = "DuplicateRelease"; throw error; }
  if (result.status >= 400) throw new Error("Supabase registry insert failed.");
  return result.data[0];
}
export function createSupabaseRegistry(): KnowledgeRegistry {
  return { async search(input: RegistrySearchRequest): Promise<RegistrySearchResponse> { const query = input.query?.trim() ?? ""; const limit = Math.min(Math.max(input.limit ?? 20, 1), 100); const filter = query ? `&or=(package_id.ilike.*${encodeURIComponent(query)}*,name.ilike.*${encodeURIComponent(query)}*,publisher.ilike.*${encodeURIComponent(query)}*)` : ""; const result = await request<RegistryRow[]>(`registry_packs?select=*&order=package_id.asc,version.desc&limit=${limit}${filter}`); if (result.status >= 400) throw new Error("Supabase registry request failed."); return { packs: result.data }; }, async get(packId: string, version?: string) { const versionFilter = version ? `&version=eq.${encodeURIComponent(version)}` : "&order=version.desc&limit=1"; const result = await request<RegistryRow[]>(`registry_packs?select=*&package_id=eq.${encodeURIComponent(packId)}${versionFilter}`); if (result.status >= 400) throw new Error("Supabase registry request failed."); return result.data[0]; } };
}
