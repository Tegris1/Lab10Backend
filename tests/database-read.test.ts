import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseRead } from "@/lib/db/read";

afterEach(() => vi.restoreAllMocks());

describe("database read error propagation", () => {
  it("returns successful data", async () => {
    const products = [{ id: 1 }];
    await expect(databaseRead("products.list", async () => products)).resolves.toBe(products);
  });

  it("preserves the original error, including its stack and driver cause", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const cause = Object.assign(new Error("Connection timed out"), { code: "ETIMEDOUT" });
    const failure = new Error("Database query failed", { cause });
    const stack = failure.stack;

    await expect(databaseRead("products.list", async () => { throw failure; })).rejects.toBe(failure);
    expect(failure.cause).toBe(cause);
    expect(failure.stack).toBe(stack);
  });
});
