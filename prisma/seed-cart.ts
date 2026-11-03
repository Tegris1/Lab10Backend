import type { PrismaClient } from "../lib/generated/prisma/client";
import { requireCartQuantity } from "../lib/cart/cart-quantity";
import { demoUser, demoUserCreateData } from "../lib/orders/demo-user";
import { requireProductId } from "../lib/products/product-id";
import { demoCart } from "./cart-fixtures";

export async function seedCart(client: PrismaClient): Promise<void> {
  for (const item of demoCart.items) {
    requireProductId(item.productId);
    requireCartQuantity(item.quantity);
  }
  await client.$transaction(async tx => {
    const user = await tx.user.upsert({
      where: { id: demoUser.id }, create: demoUserCreateData, update: {},
    });
    if (user.email !== demoUser.email) throw new Error("The demonstration user ID belongs to a different profile.");
    const cart = await tx.cart.upsert({
      where: { id: demoCart.id }, create: { id: demoCart.id, userId: demoCart.userId }, update: {},
    });
    if (cart.userId !== demoUser.id) throw new Error("The demonstration cart belongs to a different user.");
    for (const item of demoCart.items) {
      await tx.cartItem.upsert({
        where: { cartId_productId: { cartId: cart.id, productId: item.productId } },
        create: { ...item, cartId: cart.id }, update: {},
      });
    }
  });
}
