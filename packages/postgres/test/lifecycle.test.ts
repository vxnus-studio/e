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
});
