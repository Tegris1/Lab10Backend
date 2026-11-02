import type { OrderStatus, Prisma, PrismaClient } from "../generated/prisma/client";
import { requireProductId } from "../products/product-id";
import { calculateOrderTotal } from "./money";

export type NewOrderSnapshot = {
  id: string;
  number: string;
  userId: string;
  status: OrderStatus;
  orderedAt: string;
  items: readonly {
    productId: number | null;
    nameSnapshot: string;
    codeSnapshot: string;
    quantity: number;
    unitPriceGrosze: bigint;
  }[];
};

export function prepareOrderSnapshot(input: NewOrderSnapshot): Prisma.OrderUncheckedCreateInput {
  for (const text of [input.id, input.number, input.userId]) {
    if (typeof text !== "string" || text.trim() === "" || text.includes("\0")) throw new RangeError("Order identity must be nonblank text.");
  }
  if (!["PENDING", "PAID", "SHIPPED", "CANCELLED"].includes(input.status)) throw new RangeError("Unknown order status.");
  const orderedAt = new Date(input.orderedAt);
  if (!/^\d{4}-/.test(input.orderedAt) || !Number.isFinite(orderedAt.getTime()) || orderedAt.toISOString() !== input.orderedAt || input.orderedAt.startsWith("0000-")) {
    throw new RangeError("Order date must be canonical UTC with milliseconds.");
  }
  const totalGrosze = calculateOrderTotal(input.items);
  const items = input.items.map((item, index) => {
    if (item.productId !== null) requireProductId(item.productId);
    if (typeof item.nameSnapshot !== "string" || item.nameSnapshot.trim() === "" || item.nameSnapshot.includes("\0") ||
      typeof item.codeSnapshot !== "string" || item.codeSnapshot.length !== 10 || !/^[A-Z0-9]{10}$/.test(item.codeSnapshot)) {
      throw new RangeError("Order items require the purchased name and ten-character product code.");
    }
    return {
      id: `${input.id}-line-${index + 1}`, lineNumber: index + 1,
      productId: item.productId, nameSnapshot: item.nameSnapshot, codeSnapshot: item.codeSnapshot,
      quantity: item.quantity, unitPriceGrosze: item.unitPriceGrosze,
    };
  });
  return {
    id: input.id, number: input.number, userId: input.userId,
    status: input.status, orderedAt, totalGrosze, items: { create: items },
  };
}

export async function createHistoricalOrder(client: PrismaClient, input: NewOrderSnapshot) {
  return client.order.create({ data: prepareOrderSnapshot(input) });
}
