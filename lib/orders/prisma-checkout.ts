import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { CheckoutError, requireCheckoutRequestKey } from "./checkout-input";
import { prepareOrderSnapshot } from "./order-write";

class RetryCheckoutError extends Error {}

export function createCheckoutWriter(client: PrismaClient) {
  return {
    async checkoutForUser(userId: string, inputRequestKey: string) {
      if (typeof userId !== "string" || userId.trim() === "") throw new RangeError("A user ID is required.");
      const requestKey = requireCheckoutRequestKey(inputRequestKey);
      const orderId = randomUUID();

      for (let attempt = 0; ; attempt++) {
        try {
          return await client.$transaction(async tx => {
            // Check before reading the basket: a replay must not consume newly added products.
            const previous = await tx.order.findUnique({
              where: { userId_requestKey: { userId, requestKey } },
              select: { id: true, items: { select: { productId: true } } },
            });
            if (previous) return {
              orderId: previous.id,
              productIds: previous.items.flatMap(item => item.productId === null ? [] : [item.productId]),
            };

            const cart = await tx.cart.findUnique({
              where: { userId }, include: { items: { include: { product: true }, orderBy: { productId: "asc" } } },
            });
            if (!cart || cart.items.length === 0) throw new CheckoutError("EMPTY_CART", "Your basket is empty.");

            for (const item of cart.items) {
              if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
                throw new CheckoutError("INVALID_INPUT", "Review the quantities in your basket before placing an order.");
              }
              if (item.quantity > item.product.amount) {
                throw new CheckoutError("STOCK_CHANGED", "Some products no longer have enough stock. Update your basket and try again.");
              }
              // Ordered product IDs keep lock acquisition consistent across simultaneous checkouts.
              const changed = await tx.product.updateMany({
                where: { id: item.productId, amount: { gte: item.quantity } },
                data: { amount: { decrement: item.quantity } },
              });
              if (changed.count !== 1) throw new CheckoutError("STOCK_CHANGED", "Availability changed. Update your basket and try again.");
            }

            const snapshot = prepareOrderSnapshot({
              id: orderId, number: `ORD-${orderId.toUpperCase()}`, userId,
              orderedAt: new Date().toISOString(), status: "PENDING",
              items: cart.items.map(item => ({
                productId: item.productId, nameSnapshot: item.product.name, codeSnapshot: item.product.code,
                unitPriceGrosze: BigInt(item.product.price), quantity: item.quantity,
              })),
            });
            await tx.order.create({ data: { ...snapshot, requestKey }, select: { id: true } });
            const removed = await tx.cartItem.deleteMany({
              where: { cartId: cart.id, cart: { userId }, id: { in: cart.items.map(item => item.id) } },
            });
            if (removed.count !== cart.items.length) throw new RetryCheckoutError();
            return { orderId, productIds: cart.items.map(item => item.productId) };
          }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        } catch (error) {
          const retryable = error instanceof RetryCheckoutError ||
            (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code));
          if (!retryable) throw error;
          if (attempt === 4) throw new CheckoutError("CONFLICT", "Your basket or availability changed. Please try placing your order again.");
          await setTimeout(10 * 2 ** attempt + Math.floor(Math.random() * 10));
        }
      }
    },
  };
}
