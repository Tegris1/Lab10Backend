import { setTimeout } from "node:timers/promises";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { CartOperationError, requireCartItemId, requireCartProductId, requireInputQuantity } from "./cart-input";

class RetryCartTransactionError extends Error {}

function requireOwner(userId: string) {
  if (typeof userId !== "string" || userId.trim() === "") throw new RangeError("A user ID is required.");
}

async function cartTransaction<T>(client: PrismaClient, operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      // A concurrent first add may conflict on Cart.userId or CartItem's compound key.
      const retryable = error instanceof RetryCartTransactionError ||
        (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code));
      if (!retryable) throw error;
      if (attempt === 4) throw new CartOperationError("CONFLICT", "Your basket changed. Please try again.", "form");
      await setTimeout(10 * 2 ** attempt + Math.floor(Math.random() * 10));
    }
  }
}

function checkStock(quantity: number, amount: number) {
  if (quantity > 99) throw new CartOperationError("QUANTITY_LIMIT", "A basket item cannot exceed 99 units.", "quantity");
  if (quantity > amount) throw new CartOperationError("STOCK_LIMIT", "The requested quantity exceeds current stock.", "quantity");
}

export function createCartWriter(client: PrismaClient) {
  return {
    async addProductForUser(userId: string, productId: number) {
      requireOwner(userId);
      requireCartProductId(productId);
      return cartTransaction(client, async tx => {
        const product = await tx.product.findUnique({ where: { id: productId }, select: { amount: true } });
        if (!product || product.amount === 0) {
          throw new CartOperationError("PRODUCT_UNAVAILABLE", "This product is currently unavailable.", "productId");
        }
        const cart = await tx.cart.upsert({ where: { userId }, create: { userId }, update: {}, select: { id: true } });
        const item = await tx.cartItem.findUnique({
          where: { cartId_productId: { cartId: cart.id, productId } }, select: { id: true, quantity: true },
        });
        checkStock((item?.quantity ?? 0) + 1, product.amount);
        if (!item) {
          const created = await tx.cartItem.create({ data: { cartId: cart.id, productId, quantity: 1 }, select: { id: true } });
          return { itemId: created.id };
        }
        const changed = await tx.cartItem.updateMany({
          where: { id: item.id, cartId: cart.id, cart: { userId }, quantity: item.quantity },
          data: { quantity: { increment: 1 } },
        });
        if (changed.count !== 1) throw new RetryCartTransactionError();
        return { itemId: item.id };
      });
    },

    async setQuantityForUser(userId: string, itemId: string, quantity: number) {
      requireOwner(userId);
      requireCartItemId(itemId);
      requireInputQuantity(quantity);
      return cartTransaction(client, async tx => {
        const item = await tx.cartItem.findFirst({
          where: { id: itemId, cart: { userId } }, select: { quantity: true, product: { select: { amount: true } } },
        });
        if (!item) throw new CartOperationError("ITEM_UNAVAILABLE", "This basket item is unavailable.", "itemId");
        checkStock(quantity, item.product.amount);
        const changed = await tx.cartItem.updateMany({
          where: { id: itemId, cart: { userId }, quantity: item.quantity }, data: { quantity },
        });
        if (changed.count !== 1) throw new RetryCartTransactionError();
        return { itemId };
      });
    },

    async removeItemForUser(userId: string, itemId: string) {
      requireOwner(userId);
      requireCartItemId(itemId);
      const removed = await client.cartItem.deleteMany({ where: { id: itemId, cart: { userId } } });
      if (removed.count !== 1) throw new CartOperationError("ITEM_UNAVAILABLE", "This basket item is unavailable.", "itemId");
      return { itemId };
    },
  };
}
