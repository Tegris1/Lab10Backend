export type CheckoutErrorCode = "INVALID_INPUT" | "EMPTY_CART" | "STOCK_CHANGED" | "CONFLICT";

export class CheckoutError extends Error {
  constructor(public readonly code: CheckoutErrorCode, message: string) {
    super(message);
    this.name = "CheckoutError";
  }
}

export type CheckoutFailure = {
  ok: false;
  code: CheckoutErrorCode | "AUTH_REQUIRED" | "UNAVAILABLE";
  message: string;
};

export function requireCheckoutRequestKey(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new CheckoutError("INVALID_INPUT", "This order request is invalid. Reload your basket and try again.");
  }
  return value.toLowerCase();
}

export function parseCheckoutInput(input: unknown) {
  if (typeof input !== "object" || input === null || Array.isArray(input) ||
    Object.keys(input).length !== 1 || !Object.hasOwn(input, "requestKey")) {
    throw new CheckoutError("INVALID_INPUT", "This order request has invalid fields.");
  }
  return { requestKey: requireCheckoutRequestKey((input as Record<string, unknown>).requestKey) };
}
