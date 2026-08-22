import { describe, expect, test } from "vitest";
import { validateBatchDataset } from "../src/validation.js";
import { MAX_SAFE_BATCH_ITEMS } from "../src/types.js";

describe("batch safety boundary", () => {
  test("rejects batches above the hard item bound before validating every row", () => {
    expect(() => validateBatchDataset({ entities: new Array(MAX_SAFE_BATCH_ITEMS + 1).fill(null) })).toThrow(/maximum item count/);
  });
});
