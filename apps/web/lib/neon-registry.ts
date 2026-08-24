import { neon } from "@neondatabase/serverless";
import type { KnowledgeRegistry, RegistryPack, RegistrySearchRequest, RegistrySearchResponse } from "@vxnus/e-registry";

type RegistryRow = Omit<RegistryPack, "sources" | "capabilities" | "distribution"> & {
  sources: RegistryPack["sources"];
  capabilities: RegistryPack["capabilities"];
  distribution: RegistryPack["distribution"];
};

function configuredSql() {
  if (!process.env.NEON_DATABASE_URL) throw new Error("NEON_DATABASE_URL is required for HUB_REGISTRY_MODE=neon");
  return neon(process.env.NEON_DATABASE_URL);
}

function toPack(row: RegistryRow): RegistryPack { return row; }

export function createNeonRegistry(): KnowledgeRegistry {
  const sql = configuredSql();
  return {
    async search(request: RegistrySearchRequest): Promise<RegistrySearchResponse> {
      const query = request.query?.trim() ?? "";
      const limit = Math.min(Math.max(request.limit ?? 20, 1), 100);
      const rows = await sql`SELECT package_id AS id, name, publisher, version, schema_version AS "schemaVersion", description, sources, capabilities, publisher_id AS "publisherId", distribution, verified FROM registry_packs WHERE (${query} = '' OR package_id ILIKE '%' || ${query} || '%' OR name ILIKE '%' || ${query} || '%' OR publisher ILIKE '%' || ${query} || '%') ORDER BY package_id, version DESC LIMIT ${limit}` as RegistryRow[];
      return { packs: rows.map(toPack) };
    },
    async get(packId: string, version?: string) {
      const rows = version
        ? await sql`SELECT package_id AS id, name, publisher, version, schema_version AS "schemaVersion", description, sources, capabilities, publisher_id AS "publisherId", distribution, verified FROM registry_packs WHERE package_id = ${packId} AND version = ${version} LIMIT 1` as RegistryRow[]
        : await sql`SELECT package_id AS id, name, publisher, version, schema_version AS "schemaVersion", description, sources, capabilities, publisher_id AS "publisherId", distribution, verified FROM registry_packs WHERE package_id = ${packId} ORDER BY version DESC LIMIT 1` as RegistryRow[];
      return rows[0] ? toPack(rows[0]) : undefined;
    },
  };
}
