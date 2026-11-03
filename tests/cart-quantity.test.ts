import { describe, expect, it } from "vitest";
import { requireCartQuantity } from "@/lib/cart/cart-quantity";

describe("cart quantity", () => {
  it.each([1, 2, 99])("accepts %s units", quantity => {
    expect(requireCartQuantity(quantity)).toBe(quantity);
  });

  it.each([0, -1, 100, 1.5, NaN, Infinity, "1", null, undefined])("rejects %j", quantity => {
    expect(() => requireCartQuantity(quantity as number)).toThrow(RangeError);
  });
});
