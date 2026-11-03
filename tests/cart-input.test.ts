import { describe, expect, it } from "vitest";
import { CartOperationError, parseAddProduct, parseRemoveItem, parseSetQuantity } from "@/lib/cart/cart-input";

describe("closed basket request contracts", () => {
  it.each([1, 2147483647])("accepts product ID boundary %s", productId => {
    expect(parseAddProduct({ productId })).toEqual({ productId });
  });

  it.each([0, -1, 1.5, 2147483648, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, "1", null])(
    "rejects invalid product ID %j", productId => {
      expect(() => parseAddProduct({ productId })).toThrow(CartOperationError);
    },
  );

  it.each([0, -1, 1.5, 100, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, "2", null])(
    "rejects invalid quantity %j", quantity => {
      expect(() => parseSetQuantity({ itemId: "lab08-cart-item-1", quantity })).toThrow(CartOperationError);
    },
  );

  it("accepts quantity limits and both generated and existing fixture item IDs", () => {
    for (const itemId of ["cm1234567890abcdef12345678", "lab08-cart-item-1"]) {
      expect(parseRemoveItem({ itemId })).toEqual({ itemId });
      for (const quantity of [1, 99]) expect(parseSetQuantity({ itemId, quantity })).toEqual({ itemId, quantity });
    }
  });

  it.each(["", " ", "item\n", "../item", "x".repeat(129), 1, null])("rejects malformed item ID %j", itemId => {
    expect(() => parseRemoveItem({ itemId })).toThrow(CartOperationError);
  });

  it("rejects missing fields, wrong containers and extra ownership or monetary fields", () => {
    for (const input of [undefined, null, [], 1, "1", {}, { productId: 1, userId: "victim" },
      { productId: 1, cartId: "victim" }, { productId: 1, price: 0 }, { productId: 1, totalGrosze: "0" }]) {
      expect(() => parseAddProduct(input)).toThrow(CartOperationError);
    }
    expect(() => parseSetQuantity({ itemId: "item", quantity: 1, userId: "victim" })).toThrow(CartOperationError);
    expect(() => parseRemoveItem({ itemId: "item", cartId: "victim" })).toThrow(CartOperationError);
  });
});
