import "server-only";
import { requireSession, AuthenticationRequiredError } from "../auth/session";
import { prisma } from "../db/prisma";
import { findCartForUser } from "./cart-repo";
import { CartOperationError, parseAddProduct, parseRemoveItem, parseSetQuantity, type CartErrorCode, type CartField } from "./cart-input";
import { createCartWriter } from "./prisma-cart-write";

export type CartMutationResult =
  | { ok: true; itemId: string }
  | { ok: false; code: CartErrorCode | "AUTH_REQUIRED" | "UNAVAILABLE"; message: string; field: CartField };

const writer = createCartWriter(prisma);

export async function getMyCart() {
  const session = await requireSession();
  const cart = await findCartForUser(session.user.id);
  return { items: cart?.items ?? [], totalGrosze: cart?.totalGrosze ?? "0" };
}

async function mutate(operation: (userId: string) => Promise<{ itemId: string }>): Promise<CartMutationResult> {
  try {
    const session = await requireSession();
    return { ok: true, ...await operation(session.user.id) };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return { ok: false, code: "AUTH_REQUIRED", message: "Sign in to change your basket.", field: "form" };
    }
    if (error instanceof CartOperationError) {
      return { ok: false, code: error.code, message: error.message, field: error.field };
    }
    console.error("Basket operation failed.", error);
    return { ok: false, code: "UNAVAILABLE", message: "Could not update your basket. Please try again.", field: "form" };
  }
}

export async function addProductToMyCart(input: unknown) {
  return mutate(userId => {
    const { productId } = parseAddProduct(input);
    return writer.addProductForUser(userId, productId);
  });
}

export async function setMyCartQuantity(input: unknown) {
  return mutate(userId => {
    const { itemId, quantity } = parseSetQuantity(input);
    return writer.setQuantityForUser(userId, itemId, quantity);
  });
}

export async function removeMyCartItem(input: unknown) {
  return mutate(userId => {
    const { itemId } = parseRemoveItem(input);
    return writer.removeItemForUser(userId, itemId);
  });
}
