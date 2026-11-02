import type { PrismaClient } from "../generated/prisma/client";
import { calculateOrderTotal } from "./money";

export function createOrderRepository(client: PrismaClient) {
  return {
    async listOrdersForUser(userId: string) {
      if (typeof userId !== "string" || userId.trim() === "") throw new RangeError("A user ID is required.");
      const orders = await client.order.findMany({
        where: { userId }, include: { items: { orderBy: { lineNumber: "asc" } } },
        orderBy: [{ orderedAt: "desc" }, { id: "asc" }],
      });
      return orders.map(order => {
        if (calculateOrderTotal(order.items) !== order.totalGrosze) throw new Error("Stored order total differs from its historical items.");
        return {
          id: order.id, number: order.number, status: order.status,
          orderedAt: order.orderedAt.toISOString(), totalGrosze: order.totalGrosze.toString(),
          items: order.items.map(item => ({
            id: item.id, productId: item.productId, name: item.nameSnapshot, code: item.codeSnapshot,
            quantity: item.quantity, unitPriceGrosze: item.unitPriceGrosze.toString(),
            lineTotalGrosze: (BigInt(item.quantity) * item.unitPriceGrosze).toString(),
          })),
        };
      });
    },
  };
}
