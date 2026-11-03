export function requireCartQuantity(quantity: number): number {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new RangeError("Cart quantity must be an integer between 1 and 99.");
  }
  return quantity;
}
