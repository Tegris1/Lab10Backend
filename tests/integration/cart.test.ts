import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { createCartRepository } from "@/lib/cart/prisma-cart-repo";
import { demoUser, demoUserCreateData } from "@/lib/orders/demo-user";
import { getProductNameSortKey } from "@/lib/products/product-name";
import { demoCart } from "@/prisma/cart-fixtures";
import { seedCart } from "@/prisma/seed-cart";
import { seedCatalog } from "@/prisma/seed-catalog";
import { seedOrderHistory } from "@/prisma/seed-order-history";
import { createOrderRepository } from "@/lib/orders/prisma-order-repo";

const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 1000 }) });
const repository = createCartRepository(client);
const source: unknown = JSON.parse(await readFile(new URL("../../data/products.json", import.meta.url), "utf8"));
const basket = () => repository.findCartForUser(demoUser.id);
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
  await seedCart(client);
});

afterAll(async () => { await client.$disconnect(); });

describe("saved baskets in PostgreSQL", () => {
  it("seeds one stable cart and the complete shared fictional user without overwriting quantities or extra items", async () => {
    const user = await client.user.findUniqueOrThrow({ where: { id: demoUser.id } });
    expect(user).toEqual(demoUserCreateData);
    const first = await basket();
    expect(first?.items.map(item => [item.productId, item.quantity])).toEqual([[1, 1], [2, 2], [3, 3]]);
    expect(first?.totalGrosze).toBe("1670165");
    expect(() => JSON.stringify(first)).not.toThrow();
    await seedCart(client);
    expect(await basket()).toEqual(first);
    await client.cartItem.update({ where: { id: demoCart.items[0].id }, data: { quantity: 99 } });
    await client.cartItem.create({ data: { cartId: demoCart.id, productId: 4, quantity: 1 } });
    const edited = await basket();
    const products = await client.product.findMany({ orderBy: { id: "asc" } });
    await seedCart(client);
    expect(await basket()).toEqual(edited);
    expect(await client.cart.count()).toBe(1);
    expect(await client.cartItem.count()).toBe(4);
    expect(await client.product.findMany({ orderBy: { id: "asc" } })).toEqual(products);
    expect(await client.user.findUnique({ where: { id: demoUser.id } })).toEqual(user);
  });

  it("shares the user with order history and uses current prices without changing historical snapshots or stock", async () => {
    await seedOrderHistory(client);
    const orders = createOrderRepository(client);
    const history = await orders.listOrdersForUser(demoUser.id);
    const product = await client.product.findUniqueOrThrow({ where: { id: 1 } });
    expect(product.amount).toBe(97);
    const name = "Current basket product";
    await client.product.update({ where: { id: 1 }, data: { price: 1, amount: 0, name, nameSortKey: getProductNameSortKey(name) } });
    expect((await basket())?.items[0]).toMatchObject({ name, amount: 0, quantity: 1, unitPriceGrosze: "1", lineTotalGrosze: "1" });
    expect((await basket())?.totalGrosze).toBe("1224745");
    await seedCart(client);
    expect((await client.product.findUniqueOrThrow({ where: { id: 1 } })).amount).toBe(0);
    expect(await orders.listOrdersForUser(demoUser.id)).toEqual(history);
    expect(await client.user.count()).toBe(1);
  });

  it("keeps each user's cart separate and distinguishes missing from empty carts", async () => {
    expect(await repository.findCartForUser("unknown-user")).toBeNull();
    await client.user.create({ data: { id: "other-user", name: "Other fictional user", email: "other@example.test" } });
    const other = await client.cart.create({ data: { userId: "other-user" } });
    expect(await repository.findCartForUser("other-user")).toEqual({ id: other.id, userId: "other-user", items: [], totalGrosze: "0" });
    await client.cartItem.create({ data: { cartId: other.id, productId: 1, quantity: 1 } });
    expect((await basket())?.items).toHaveLength(3);
    expect((await repository.findCartForUser("other-user"))?.items).toHaveLength(1);
    await expect(repository.findCartForUser(" ")).rejects.toThrow(RangeError);
  });

  it("enforces cart ownership, unique products and foreign keys without application validation", async () => {
    await expect(client.cart.create({ data: { userId: demoUser.id } })).rejects.toMatchObject({ code: "P2002" });
    await expect(client.cartItem.create({ data: { cartId: demoCart.id, productId: 1, quantity: 1 } })).rejects.toMatchObject({ code: "P2002" });
    await expect(client.cart.create({ data: { userId: "missing-user" } })).rejects.toMatchObject({ code: "P2003" });
    await expect(client.cartItem.create({ data: { cartId: "missing-cart", productId: 4, quantity: 1 } })).rejects.toMatchObject({ code: "P2003" });
    await expect(client.cartItem.create({ data: { cartId: demoCart.id, productId: 2147483647, quantity: 1 } })).rejects.toMatchObject({ code: "P2003" });
  });

  it("checks quantity boundaries directly in SQL", async () => {
    const id = demoCart.items[0].id;
    for (const quantity of [0, -1, 100]) {
      await expect(client.$executeRaw`UPDATE "CartItem" SET "quantity" = ${quantity} WHERE "id" = ${id}`)
        .rejects.toMatchObject(sqlError("23514"));
    }
    for (const quantity of [1, 99]) {
      await client.$executeRaw`UPDATE "CartItem" SET "quantity" = ${quantity} WHERE "id" = ${id}`;
      expect((await client.cartItem.findUniqueOrThrow({ where: { id } })).quantity).toBe(quantity);
    }
  });

  it("cascades cart and user deletion to their items", async () => {
    await client.cart.delete({ where: { id: demoCart.id } });
    expect(await client.cartItem.count()).toBe(0);
    expect(await client.user.findUnique({ where: { id: demoUser.id } })).not.toBeNull();
    expect(await client.product.count()).toBe(100);
    await seedCart(client);
    await client.user.delete({ where: { id: demoUser.id } });
    expect(await client.cart.count()).toBe(0);
    expect(await client.cartItem.count()).toBe(0);
  });

  it("blocks deletion of a product in a basket and preserves history after its final basket item is removed", async () => {
    await seedOrderHistory(client);
    const before = await basket();
    await expect(client.product.delete({ where: { id: 1 } })).rejects.toMatchObject({ code: "P2003" });
    await expect(client.$executeRaw`DELETE FROM "Product" WHERE "id" = 1`).rejects.toMatchObject(sqlError("23503"));
    expect(await basket()).toEqual(before);
    await client.cartItem.delete({ where: { id: demoCart.items[0].id } });
    await client.product.delete({ where: { id: 1 } });
    expect((await basket())?.items.map(item => item.productId)).toEqual([2, 3]);
    const item = await client.orderItem.findUniqueOrThrow({ where: { id: "lab08-order-0001-line-1" } });
    expect(item).toMatchObject({ productId: null, nameSnapshot: "Quantum DISK 1", unitPriceGrosze: BigInt(445421) });
  });

  it("rolls back the new user, cart and earlier items when the last product is missing", async () => {
    await client.user.delete({ where: { id: demoUser.id } });
    await client.product.delete({ where: { id: 3 } });
    await expect(seedCart(client)).rejects.toMatchObject({ code: "P2003" });
    expect(await client.user.findUnique({ where: { id: demoUser.id } })).toBeNull();
    expect(await client.cart.count()).toBe(0);
    expect(await client.cartItem.count()).toBe(0);
  });

  it("rejects occupied demo identities without altering existing carts", async () => {
    await client.user.create({ data: { id: "other-user", name: "Other fictional user", email: "other@example.test" } });
    await client.cart.update({ where: { id: demoCart.id }, data: { userId: "other-user" } });
    const before = await client.cartItem.findMany({ orderBy: { id: "asc" } });
    await expect(seedCart(client)).rejects.toThrow("different user");
    expect(await client.cartItem.findMany({ orderBy: { id: "asc" } })).toEqual(before);
    await client.cart.update({ where: { id: demoCart.id }, data: { userId: demoUser.id } });
    await client.user.update({ where: { id: demoUser.id }, data: { email: "changed@example.test" } });
    await expect(seedCart(client)).rejects.toThrow("different profile");
  });

  it("runs the standalone seed and read commands without resetting catalogue changes", async () => {
    await client.product.update({ where: { id: 1 }, data: { amount: 0, price: 1 } });
    const run = (script: string) => spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", script], {
      env: process.env, encoding: "utf8", windowsHide: true, timeout: 10000,
    });
    expect(run("scripts/seed-cart.ts").status).toBe(0);
    const output = run("scripts/show-cart.ts");
    expect(output.status).toBe(0);
    expect(JSON.parse(output.stdout)).toEqual(await basket());
    expect((await client.product.findUniqueOrThrow({ where: { id: 1 } })).amount).toBe(0);
  });

  it("propagates database failures instead of returning an absent or empty basket", async () => {
    const badUrl = new URL(process.env.DATABASE_URL!);
    badUrl.port = "1";
    const unavailable = new PrismaClient({ adapter: new PrismaPg({ connectionString: badUrl.toString(), connectionTimeoutMillis: 500 }) });
    try {
      await expect(createCartRepository(unavailable).findCartForUser(demoUser.id)).rejects.toThrow();
    } finally { await unavailable.$disconnect(); }
  });
});
