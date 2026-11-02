import { describe, expect, it } from "vitest";
import { parseStockArguments } from "@/lib/products/product-stock";

describe("local stock command arguments", () => {
  it("accepts the integer boundaries", () => {
    expect(parseStockArguments(["1", "0"])).toEqual({ id: 1, amount: 0 });
    expect(parseStockArguments(["2147483647", "2147483647"])).toEqual({ id: 2147483647, amount: 2147483647 });
  });
  it("rejects incomplete, repeated, fractional and out-of-range arguments", () => {
    for (const args of [[], ["1"], ["1", "0", "2"], ["01", "1"], ["1", "-1"], ["1", "1.5"],
      ["1", "1x"], ["1", "01"], ["0", "1"], ["2147483648", "1"], ["1", "2147483648"]]) {
      expect(() => parseStockArguments(args)).toThrow(RangeError);
    }
  });
});
