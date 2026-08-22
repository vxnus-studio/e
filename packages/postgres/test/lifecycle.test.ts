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
});
