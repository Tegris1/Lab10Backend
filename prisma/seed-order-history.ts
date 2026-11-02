import type { PrismaClient } from "../lib/generated/prisma/client";
import { demoUser } from "../lib/orders/demo-user";
import { prepareOrderSnapshot } from "../lib/orders/order-write";
import { demoOrders } from "./order-history-fixtures";

export async function seedOrderHistory(client: PrismaClient): Promise<void> {
  const orders = demoOrders.map(prepareOrderSnapshot);
  await client.$transaction(async tx => {
    const user = await tx.user.upsert({
      where: { id: demoUser.id }, update: {},
      create: { ...demoUser, emailVerified: false, image: null,
        createdAt: new Date("2026-10-01T00:00:00.000Z"), updatedAt: new Date("2026-10-01T00:00:00.000Z") },
    });
    if (user.email !== demoUser.email) throw new Error("The demonstration user ID belongs to a different profile.");
    for (const data of orders) {
      const order = await tx.order.upsert({ where: { id: data.id }, create: data, update: {} });
      if (order.userId !== demoUser.id || order.number !== data.number) throw new Error("The demonstration order identity conflicts with existing history.");
    }
  });
}
