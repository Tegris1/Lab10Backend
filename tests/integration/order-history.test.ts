import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { demoUser } from "@/lib/orders/demo-user";
import { createOrderRepository } from "@/lib/orders/prisma-order-repo";
import { createHistoricalOrder } from "@/lib/orders/order-write";
import { getProductNameSortKey } from "@/lib/products/product-name";
import { demoOrders } from "@/prisma/order-history-fixtures";
import { seedCatalog } from "@/prisma/seed-catalog";
import { seedOrderHistory } from "@/prisma/seed-order-history";

const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 1000 }) });
const repository = createOrderRepository(client);
const source: unknown = JSON.parse(await readFile(new URL("../../data/products.json", import.meta.url), "utf8"));
const history = () => repository.listOrdersForUser(demoUser.id);
const sqlError = (originalCode: string) => ({ code: "P2010", meta: { driverAdapterError: { cause: { originalCode } } } });

beforeAll(async () => {
  const [identity] = await client.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  expect(identity.name).toMatch(/^shop_lab08_test_integration_[a-f0-9]{16}$/);
});
beforeEach(async () => {
  await client.order.deleteMany();
  await client.user.deleteMany();
  await client.product.deleteMany();
  await seedCatalog(client, source);
  await seedOrderHistory(client);
});
afterAll(async () => { await client.$disconnect(); });

describe("historical orders in PostgreSQL", () => {
  it("seeds four stable orders and a complete fictional user without duplicates or timestamp changes", async () => {
    const first = await history();
    const user = await client.user.findUniqueOrThrow({ where: { id: demoUser.id } });
    expect(user).toMatchObject({ ...demoUser, emailVerified: false, image: null });
    expect(user.createdAt.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(first.map(order => order.number)).toEqual(["LAB08-2026-0004", "LAB08-2026-0003", "LAB08-2026-0002", "LAB08-2026-0001"]);
    expect(first.map(order => order.totalGrosze)).toEqual(["957014", "487279", "395484", "773075"]);
    expect(() => JSON.stringify(first)).not.toThrow();
    await seedOrderHistory(client);
    expect(await history()).toEqual(first);
    expect(await client.user.findUnique({ where: { id: demoUser.id } })).toEqual(user);
    expect(await client.orderItem.count()).toBe(6);
    await createHistoricalOrder(client, { ...demoOrders[0], id: "unrelated-order", number: "UNRELATED-ORDER" });
    const withAdditionalOrder = await history();
    await seedOrderHistory(client);
    expect(await history()).toEqual(withAdditionalOrder);
  });

  it("preserves snapshots after current product values change and after another seed", async () => {
    const first = await history();
    const name = "Changed live product";
    await client.product.update({ where: { id: 1 }, data: {
      name, nameSortKey: getProductNameSortKey(name), code: "CHANGED001", price: 1,
    } });
    expect((await client.product.findUniqueOrThrow({ where: { id: 1 } })).price).toBe(1);
    expect(await history()).toEqual(first);
    await seedOrderHistory(client);
    expect(await history()).toEqual(first);
  });

  it("retains the complete historical item after product deletion, including when reseeding", async () => {
    const before = (await history()).find(order => order.id === demoOrders[0].id)!;
    await client.product.delete({ where: { id: 1 } });
    const after = (await history()).find(order => order.id === before.id)!;
    expect(after).toEqual({ ...before, items: before.items.map(item => item.productId === 1 ? { ...item, productId: null } : item) });
    await seedOrderHistory(client);
    expect((await history()).find(order => order.id === before.id)).toEqual(after);
  });

  it("filters by user and returns an empty history for a user with no orders", async () => {
    expect(await repository.listOrdersForUser("another-user")).toEqual([]);
    await expect(repository.listOrdersForUser(" ")).rejects.toThrow(RangeError);
    await expect(client.user.delete({ where: { id: demoUser.id } })).rejects.toMatchObject({ code: "P2003" });
  });

  it("enforces SQL checks, unique order numbers, statuses and exact BIGINT values without the validator", async () => {
    const itemId = `${demoOrders[0].id}-line-1`;
    for (const quantity of [0, -1]) {
      await expect(client.$executeRaw`UPDATE "OrderItem" SET "quantity" = ${quantity} WHERE "id" = ${itemId}`)
        .rejects.toMatchObject(sqlError("23514"));
    }
    await expect(client.$executeRaw`UPDATE "OrderItem" SET "unitPriceGrosze" = -1 WHERE "id" = ${itemId}`)
      .rejects.toMatchObject(sqlError("23514"));
    await expect(client.$executeRaw`UPDATE "Order" SET "totalGrosze" = -1 WHERE "id" = ${demoOrders[0].id}`)
      .rejects.toMatchObject(sqlError("23514"));
    await expect(client.$executeRaw`UPDATE "Order" SET "status" = 'UNKNOWN' WHERE "id" = ${demoOrders[0].id}`)
      .rejects.toMatchObject(sqlError("22P02"));
    await expect(createHistoricalOrder(client, { ...demoOrders[0], id: "duplicate-number" })).rejects.toMatchObject({ code: "P2002" });
    const precise = { ...demoOrders[0], id: "precise-order", number: "PRECISE-ORDER",
      items: [{ ...demoOrders[0].items[0], quantity: 1, unitPriceGrosze: BigInt("9007199254740993") }] };
    await createHistoricalOrder(client, precise);
    expect((await history()).find(order => order.id === precise.id)?.totalGrosze).toBe("9007199254740993");
  });

  it("rolls back a partially inserted order and rejects inconsistent historical totals", async () => {
    const count = await client.order.count();
    await expect(createHistoricalOrder(client, { ...demoOrders[0], id: "failed-order", number: "FAILED-ORDER",
      items: [demoOrders[0].items[0], { ...demoOrders[0].items[1], productId: 2147483647 }] })).rejects.toMatchObject({ code: "P2003" });
    expect(await client.order.count()).toBe(count);
    expect(await client.orderItem.count({ where: { orderId: "failed-order" } })).toBe(0);
    await client.order.update({ where: { id: demoOrders[0].id }, data: { totalGrosze: BigInt(0) } });
    await expect(history()).rejects.toThrow("Stored order total");
  });

  it("rolls back the demo user and earlier orders when the final seeded order number conflicts", async () => {
    await client.order.deleteMany();
    await client.user.delete({ where: { id: demoUser.id } });
    await client.user.create({ data: { id: "other-user", name: "Other fictional user", email: "other@example.test", emailVerified: false } });
    await createHistoricalOrder(client, { ...demoOrders[3], id: "occupied-order", userId: "other-user" });
    await expect(seedOrderHistory(client)).rejects.toMatchObject({ code: "P2002" });
    expect(await client.user.findUnique({ where: { id: demoUser.id } })).toBeNull();
    expect((await client.order.findMany()).map(order => order.id)).toEqual(["occupied-order"]);
    expect(await client.orderItem.count()).toBe(1);
  });
});
