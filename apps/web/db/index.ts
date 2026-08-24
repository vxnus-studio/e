import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let database: ReturnType<typeof drizzle<typeof schema>> | undefined;
export function getDatabase() {
  if (database) return database;
  const url = process.env.DATABASE_URL || process.env.SUPABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for the Supabase database.");
  const sql = postgres(url, { prepare: false, ssl: "require", max: 1 });
  database = drizzle(sql, { schema });
  return database;
}
