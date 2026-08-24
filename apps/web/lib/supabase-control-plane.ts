import "server-only";

export type PublisherProject = { id: string; publisher: string; name: string; description: string | null; visibility: "private" | "public"; created_at: string; updated_at: string };

function config() { const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY; return url && key ? { url: url.replace(/\/$/, ""), key } : null; }
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const settings = config(); if (!settings) throw new Error("Supabase control plane is not configured.");
  const response = await fetch(`${settings.url}/rest/v1/${path}`, { ...init, headers: { apikey: settings.key, Authorization: `Bearer ${settings.key}`, "Content-Type": "application/json", Prefer: "return=representation", ...init?.headers }, cache: "no-store" });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}).`); return response.json() as Promise<T>;
}
// Neon session IDs cannot safely be used as auth.users foreign keys. Keep the
// control plane dark until the Supabase Auth adapter is the session boundary.
export function isControlPlaneConfigured() { return config() !== null && process.env.SUPABASE_AUTH_ENABLED === "true"; }
export function listPublisherProjects(ownerId: string) { return request<PublisherProject[]>(`publisher_projects?owner_id=eq.${encodeURIComponent(ownerId)}&order=updated_at.desc`); }
export async function createPublisherProject(input: { ownerId: string; publisher: string; name: string; description?: string }) {
  const rows = await request<PublisherProject[]>("publisher_projects", { method: "POST", body: JSON.stringify({ owner_id: input.ownerId, publisher: input.publisher, name: input.name, description: input.description || null }) }); return rows[0];
}
