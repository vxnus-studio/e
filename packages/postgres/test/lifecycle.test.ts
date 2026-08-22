import { describe, expect, test } from "vitest";
import { PostgresEngine } from "../src/index.js";

describe("PostgreSQL engine lifecycle", () => {
  test("close is idempotent and operations after close use the canonical storage error", async () => {
    const engine = new PostgresEngine({ connectionString: "postgresql://unused" });

    await engine.close();
    await expect(engine.close()).resolves.toBeUndefined();
    await expect(engine.query({ type: "getCapabilities" })).rejects.toMatchObject({
      name: "StorageError",
      code: "ENGINE_CLOSED",
    });
  });

  test("pool background errors are captured as storage errors instead of uncaught events", async () => {
    const engine = new PostgresEngine({ connectionString: "postgresql://unused" });
    const pool = (engine as any).pool;
    const failure = new Error("idle client disconnected");
    pool.emit("error", failure);

    await expect(engine.query({ type: "getCapabilities" })).rejects.toMatchObject({
      name: "StorageError",
      code: "POOL_BACKGROUND_ERROR",
      cause: failure,
    });
    await engine.close();
  });

  test("migration lifecycle locks, records version, and rolls back failures", async () => {
    const queries: string[] = [];
    let fail = false;
    const client = {
      query: async (text: string) => {
        queries.push(text);
        if (fail && text.includes("ALTER TABLE")) throw new Error("DDL failed");
        if (text.includes("SELECT version, name")) return { rows: [] };
        return { rows: [] };
      },
      release: () => undefined,
    };
    const fakePool = {
      connect: async () => client,
      end: async () => undefined,
      on: () => fakePool,
      removeListener: () => fakePool,
    };
    const engine = new PostgresEngine({ connectionString: "postgresql://unused" });
    (engine as any).pool = fakePool;

    await engine.migrate();
    expect(queries[0]).toBe("BEGIN");
    expect(queries).toContain("SELECT pg_advisory_xact_lock(hashtext('e-schema-migrations'))");
    expect(queries.some((query) => query.includes("INSERT INTO e_schema_migrations"))).toBe(true);

    fail = true;
    await expect(engine.migrate()).rejects.toMatchObject({ name: "StorageError", code: "SCHEMA_MIGRATION_FAILED" });
    expect(queries).toContain("ROLLBACK");
    await engine.close();
  });
});
