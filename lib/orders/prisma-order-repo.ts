import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { calculateOrderTotal } from "./money";

type StoredOrder = Prisma.OrderGetPayload<{ include: { items: true } }>;

function orderView(order: StoredOrder) {
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
}

export type OrderView = ReturnType<typeof orderView>;

function requireOwner(userId: string) {
  if (typeof userId !== "string" || userId.trim() === "") throw new RangeError("A user ID is required.");
}

export function createOrderRepository(client: PrismaClient) {
  return {
    async listOrdersForUser(userId: string) {
      requireOwner(userId);
      const orders = await client.order.findMany({
        where: { userId }, include: { items: { orderBy: { lineNumber: "asc" } } },
        orderBy: [{ orderedAt: "desc" }, { id: "asc" }],
      });
      return orders.map(orderView);
    },
    async findOrderForUser(userId: string, orderId: unknown) {
      requireOwner(userId);
      if (typeof orderId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(orderId)) return null;
      const order = await client.order.findFirst({
        where: { id: orderId, userId }, include: { items: { orderBy: { lineNumber: "asc" } } },
      });
      return order ? orderView(order) : null;
    },
  };
}
