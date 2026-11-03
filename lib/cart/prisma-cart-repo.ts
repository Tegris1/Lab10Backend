import type { PrismaClient } from "../generated/prisma/client";
import { calculateOrderTotal } from "../orders/money";
import { requireCartQuantity } from "./cart-quantity";

export function createCartRepository(client: PrismaClient) {
  return {
    async findCartForUser(userId: string) {
      if (typeof userId !== "string" || userId.trim() === "") throw new RangeError("A user ID is required.");
      const cart = await client.cart.findUnique({
        where: { userId },
        include: { items: { include: { product: true }, orderBy: { productId: "asc" } } },
      });
      if (!cart) return null;
      const items = cart.items.map(item => {
        const quantity = requireCartQuantity(item.quantity);
        const unitPriceGrosze = BigInt(item.product.price);
        return {
          id: item.id, productId: item.productId, quantity,
          name: item.product.name, code: item.product.code, amount: item.product.amount,
          image: item.product.image,
          unitPriceGrosze: unitPriceGrosze.toString(),
          lineTotalGrosze: (BigInt(quantity) * unitPriceGrosze).toString(),
        };
      });
      const totalGrosze = items.length === 0 ? BigInt(0) : calculateOrderTotal(items.map(item => ({
        quantity: item.quantity, unitPriceGrosze: BigInt(item.unitPriceGrosze),
      })));
      return { id: cart.id, userId: cart.userId, items, totalGrosze: totalGrosze.toString() };
    },
  };
}
