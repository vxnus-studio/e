import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required");
  const cookieStore = await cookies();
  return createServerClient(url, key, { cookies: { getAll() { return cookieStore.getAll(); }, setAll(values) { try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Server Components cannot always set cookies. */ } } } });
}
export async function createAuthServerClient() { return client(); }

export const auth = {
  async getSession() {
    const result = await (await client()).auth.getUser();
    return { data: { session: result.data.user ? { user: result.data.user } : null, user: result.data.user ?? null }, error: result.error };
  },
};
