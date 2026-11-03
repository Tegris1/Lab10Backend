import "server-only";
import { requireSession, AuthenticationRequiredError } from "../auth/session";
import { prisma } from "../db/prisma";
import { CheckoutError, parseCheckoutInput, type CheckoutFailure } from "./checkout-input";
import { createCheckoutWriter } from "./prisma-checkout";

const writer = createCheckoutWriter(prisma);
type CheckoutResult = { ok: true; orderId: string; productIds: number[] } | CheckoutFailure;

export async function checkoutMyCart(input: unknown): Promise<CheckoutResult> {
  try {
    const session = await requireSession();
    const { requestKey } = parseCheckoutInput(input);
    return { ok: true, ...await writer.checkoutForUser(session.user.id, requestKey) };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return {
      ok: false, code: "AUTH_REQUIRED", message: "Sign in to place an order.",
    };
    if (error instanceof CheckoutError) return { ok: false, code: error.code, message: error.message };
    console.error("Checkout failed.", error);
    return { ok: false, code: "UNAVAILABLE", message: "Could not confirm your order. Please retry using this order button." };
  }
}
