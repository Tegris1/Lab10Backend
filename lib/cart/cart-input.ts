export type CartField = "productId" | "itemId" | "quantity" | "form";
export type CartErrorCode = "INVALID_INPUT" | "PRODUCT_UNAVAILABLE" | "ITEM_UNAVAILABLE" | "QUANTITY_LIMIT" | "STOCK_LIMIT" | "CONFLICT";

export class CartOperationError extends Error {
  constructor(public readonly code: CartErrorCode, message: string, public readonly field: CartField) {
    super(message);
    this.name = "CartOperationError";
  }
}

function inputRecord(input: unknown, fields: readonly string[]): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input) ||
    Object.keys(input).some(key => !fields.includes(key)) || fields.some(key => !Object.hasOwn(input, key))) {
    throw new CartOperationError("INVALID_INPUT", "The basket request has invalid fields.", "form");
  }
  return input as Record<string, unknown>;
}

export function requireCartProductId(input: unknown): number {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 1 || input > 2147483647) {
    throw new CartOperationError("INVALID_INPUT", "Choose a valid product.", "productId");
  }
  return input;
}

export function requireCartItemId(input: unknown): string {
  // Accept generated CUIDs and the stable text IDs of existing Lab 08 fixtures.
  if (typeof input !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(input)) {
    throw new CartOperationError("INVALID_INPUT", "Choose a valid basket item.", "itemId");
  }
  return input;
}

export function requireInputQuantity(input: unknown): number {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 1 || input > 99) {
    throw new CartOperationError("INVALID_INPUT", "Quantity must be a whole number from 1 to 99.", "quantity");
  }
  return input;
}

export function parseAddProduct(input: unknown) {
  const values = inputRecord(input, ["productId"]);
  return { productId: requireCartProductId(values.productId) };
}

export function parseSetQuantity(input: unknown) {
  const values = inputRecord(input, ["itemId", "quantity"]);
  return { itemId: requireCartItemId(values.itemId), quantity: requireInputQuantity(values.quantity) };
}

export function parseRemoveItem(input: unknown) {
  const values = inputRecord(input, ["itemId"]);
  return { itemId: requireCartItemId(values.itemId) };
}
