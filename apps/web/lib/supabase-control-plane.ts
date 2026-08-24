import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDatabase } from "@/db";
import { publisherProjects } from "@/db/schema";

export type PublisherProject = { id: string; publisher: string; name: string; description: string | null; visibility: "private" | "public"; created_at: string; updated_at: string };
export function isControlPlaneConfigured() { return Boolean((process.env.DATABASE_URL || process.env.SUPABASE_URL) && process.env.SUPABASE_AUTH_ENABLED === "true"); }
export async function listPublisherProjects(ownerId: string): Promise<PublisherProject[]> { const rows = await getDatabase().select().from(publisherProjects).where(eq(publisherProjects.ownerId, ownerId)).orderBy(desc(publisherProjects.updatedAt)); return rows.map((row) => ({ id: row.id, publisher: row.publisher, name: row.name, description: row.description, visibility: row.visibility as "private" | "public", created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString() })); }
export async function createPublisherProject(input: { ownerId: string; publisher: string; name: string; description?: string }) { const rows = await getDatabase().insert(publisherProjects).values({ ownerId: input.ownerId, publisher: input.publisher, name: input.name, description: input.description || null }).returning(); return rows[0]; }
