import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { serializeSignedCookie } from "better-call";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { AuthenticationRequiredError } from "@/lib/auth/session";
import { getMyCart } from "@/lib/cart/my-cart";
import { addProduct, removeItem, setQuantity } from "@/app/basket/actions";

const request = vi.hoisted(() => ({ headers: new Headers() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => request.headers }));
vi.mock("next/cache", () => ({ revalidatePath }));

const productId = 900001;
const userA = "basket-operations-user-a";
const userB = "basket-operations-user-b";
let cookieA: string;
let cookieB: string;
let sessionA: string;
const asCookie = (cookie: string) => { request.headers = new Headers({ cookie }); };

async function issueSession(userId: string) {
  const context = await auth.$context;
  const session = await context.internalAdapter.createSession(userId);
  const cookie = context.authCookies.sessionToken;
  const signed = await serializeSignedCookie(cookie.name, session.token, process.env.BETTER_AUTH_SECRET!, cookie.attributes);
  return { id: session.id, cookie: signed.split(";")[0] };
}

beforeAll(async () => {
  const [identity] = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  expect(identity.name).toMatch(/^shop_lab08_test_integration_[a-f0-9]{16}$/);
});

beforeEach(async () => {
  await prisma.order.deleteMany();
  await prisma.user.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.upsert({ where: { code: "cpu" }, create: { code: "cpu", name: "CPU" }, update: {} });
  for (const [index, amount] of [100, 2, 0, 1].entries()) {
    await prisma.product.create({ data: {
      id: productId + index, code: `CARTTEST0${index + 1}`, name: `Operation product ${index + 1}`,
      description: "Isolated basket test product", image: "/img/cpu.jpg", price: 1234,
      amount, date: new Date("2026-11-01T00:00:00.000Z"), nameSortKey: `operation product ${index + 1}`, categoryCode: "cpu",
    } });
  }
  await prisma.user.createMany({ data: [
    { id: userA, name: "Basket Customer A", email: "basket-a@example.test" },
    { id: userB, name: "Basket Customer B", email: "basket-b@example.test" },
  ] });
  const first = await issueSession(userA);
  cookieA = first.cookie; sessionA = first.id;
  cookieB = (await issueSession(userB)).cookie;
  asCookie(cookieA);
  revalidatePath.mockClear();
});
afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("protected basket Server Actions with real database sessions", () => {
  it("reads an empty basket without creating it, then adds, sets and removes its own item", async () => {
    expect(await getMyCart()).toEqual({ items: [], totalGrosze: "0" });
    expect(await prisma.cart.count()).toBe(0);
    const added = await addProduct({ productId });
    expect(added.ok).toBe(true);
    if (!added.ok) throw new Error("Expected add to succeed.");
    expect(await prisma.cart.count()).toBe(1);
    expect((await getMyCart()).totalGrosze).toBe("1234");
    expect(revalidatePath).toHaveBeenCalledWith("/basket");
    expect(revalidatePath).toHaveBeenCalledWith("/pages/basket");
    expect(await addProduct({ productId })).toEqual(added);
    expect(await prisma.cartItem.count()).toBe(1);
    expect((await getMyCart()).items[0].quantity).toBe(2);
    expect((await setQuantity({ itemId: added.itemId, quantity: 3 })).ok).toBe(true);
    expect((await getMyCart()).totalGrosze).toBe("3702");
    expect((await removeItem({ itemId: added.itemId })).ok).toBe(true);
    expect(await getMyCart()).toEqual({ items: [], totalGrosze: "0" });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).amount).toBe(100);
  });

  it("uses current server prices, including zero and large exact grosze totals", async () => {
    const added = await addProduct({ productId });
    if (!added.ok) throw new Error("Expected add to succeed.");
    await setQuantity({ itemId: added.itemId, quantity: 99 });
    await prisma.product.update({ where: { id: productId }, data: { price: 2147483647 } });
    expect((await getMyCart()).totalGrosze).toBe((BigInt(2147483647) * BigInt(99)).toString());
    await prisma.product.update({ where: { id: productId }, data: { price: 0 } });
    expect((await getMyCart()).totalGrosze).toBe("0");
  });

  it("keeps A's and B's baskets separate and gives identical denials for foreign and missing items", async () => {
    const ownA = await addProduct({ productId });
    asCookie(cookieB);
    expect(await getMyCart()).toEqual({ items: [], totalGrosze: "0" });
    const ownB = await addProduct({ productId: productId + 1 });
    if (!ownA.ok || !ownB.ok) throw new Error("Expected both users to add their own items.");
    const before = await getMyCart();
    asCookie(cookieA);
    expect((await getMyCart()).items.map(item => item.id)).toEqual([ownA.itemId]);
    const foreignChange = await setQuantity({ itemId: ownB.itemId, quantity: 2 });
    const missingChange = await setQuantity({ itemId: "missing-item", quantity: 2 });
    expect(foreignChange).toEqual(missingChange);
    expect(foreignChange).toMatchObject({ ok: false, code: "ITEM_UNAVAILABLE" });
    expect(await removeItem({ itemId: ownB.itemId })).toEqual(await removeItem({ itemId: "missing-item" }));
    asCookie(cookieB);
    expect(await getMyCart()).toEqual(before);
  });

  it("rejects invalid values and tampered ownership or price fields without writing or refreshing", async () => {
    for (const input of [{ productId: 0 }, { productId: "900001" }, { productId: 1.5 },
      { productId, userId: userB }, { productId, cartId: "foreign-cart" }, { productId, price: 0 }, { productId, totalGrosze: "0" }]) {
      expect(await addProduct(input)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    }
    expect(await prisma.cart.count()).toBe(0);
    expect(revalidatePath).not.toHaveBeenCalled();
    const added = await addProduct({ productId });
    if (!added.ok) throw new Error("Expected add to succeed.");
    const before = await getMyCart();
    revalidatePath.mockClear();
    for (const quantity of [0, -1, 1.5, 100, "2", Number.MAX_SAFE_INTEGER + 1]) {
      expect(await setQuantity({ itemId: added.itemId, quantity })).toMatchObject({ ok: false, code: "INVALID_INPUT", field: "quantity" });
    }
    expect(await removeItem({ itemId: added.itemId, userId: userB })).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(await getMyCart()).toEqual(before);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects missing or unavailable products without leaving an empty cart", async () => {
    for (const id of [2147483647, productId + 2]) expect(await addProduct({ productId: id })).toMatchObject({ ok: false, code: "PRODUCT_UNAVAILABLE" });
    expect(await prisma.cart.count()).toBe(0);
    expect(await prisma.cartItem.count()).toBe(0);
  });

  it("rejects stock overflow and permits correction or removal after stock falls", async () => {
    const added = await addProduct({ productId: productId + 1 });
    if (!added.ok) throw new Error("Expected add to succeed.");
    expect(await setQuantity({ itemId: added.itemId, quantity: 3 })).toMatchObject({ ok: false, code: "STOCK_LIMIT" });
    await setQuantity({ itemId: added.itemId, quantity: 2 });
    await prisma.product.update({ where: { id: productId + 1 }, data: { amount: 1 } });
    expect((await getMyCart()).items[0]).toMatchObject({ quantity: 2, amount: 1 });
    expect((await setQuantity({ itemId: added.itemId, quantity: 1 })).ok).toBe(true);
    await prisma.product.update({ where: { id: productId + 1 }, data: { amount: 0 } });
    expect(await setQuantity({ itemId: added.itemId, quantity: 1 })).toMatchObject({ ok: false, code: "STOCK_LIMIT" });
    expect((await removeItem({ itemId: added.itemId })).ok).toBe(true);
  });

  it.each([
    { stock: 100, initial: 0, wins: 2, final: 2 },
    { stock: 100, initial: 98, wins: 1, final: 99 },
    { stock: 2, initial: 1, wins: 1, final: 2 },
    { stock: 1, initial: 0, wins: 1, final: 1 },
  ])("handles two concurrent additions with stock=$stock and initial quantity=$initial", async ({ stock, initial, wins, final }) => {
    await prisma.product.update({ where: { id: productId }, data: { amount: stock } });
    if (initial > 0) {
      const added = await addProduct({ productId });
      if (!added.ok) throw new Error("Expected initial add to succeed.");
      expect((await setQuantity({ itemId: added.itemId, quantity: initial })).ok).toBe(true);
    }
    const results = await Promise.all([addProduct({ productId }), addProduct({ productId })]);
    expect(results.filter(result => result.ok)).toHaveLength(wins);
    expect(await prisma.cart.count({ where: { userId: userA } })).toBe(1);
    const items = await prisma.cartItem.findMany({ where: { cart: { userId: userA } } });
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(final);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).amount).toBe(stock);
  });

  it("rejects direct mutation calls without a valid session, after expiry and after sign-out", async () => {
    for (const cookie of ["", "better-auth.session_token=forged-token"]) {
      asCookie(cookie);
      expect(await addProduct({ productId })).toMatchObject({ ok: false, code: "AUTH_REQUIRED" });
      expect(await setQuantity({ itemId: "missing-item", quantity: 1 })).toMatchObject({ ok: false, code: "AUTH_REQUIRED" });
      expect(await removeItem({ itemId: "missing-item" })).toMatchObject({ ok: false, code: "AUTH_REQUIRED" });
      await expect(getMyCart()).rejects.toBeInstanceOf(AuthenticationRequiredError);
    }
    asCookie(cookieA);
    await prisma.session.update({ where: { id: sessionA }, data: { expiresAt: new Date("2000-01-01T00:00:00.000Z") } });
    expect(await addProduct({ productId })).toMatchObject({ ok: false, code: "AUTH_REQUIRED" });
    const replacement = await issueSession(userA);
    asCookie(replacement.cookie);
    const signedOut = await auth.api.signOut({ headers: request.headers });
    expect(signedOut.success).toBe(true);
    expect(await addProduct({ productId })).toMatchObject({ ok: false, code: "AUTH_REQUIRED" });
    expect(await prisma.cart.count()).toBe(0);
    expect(await prisma.cartItem.count()).toBe(0);
  });

  it("returns a safe failure for database errors and limits transaction retries", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const transaction = vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(new Error("Sensitive ORM details"));
    expect(await addProduct({ productId })).toEqual({ ok: false, code: "UNAVAILABLE", field: "form", message: "Could not update your basket. Please try again." });
    expect(await prisma.cart.count()).toBe(0);
    transaction.mockClear().mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Write conflict", { code: "P2034", clientVersion: "7.10.1" }));
    expect(await addProduct({ productId })).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(transaction).toHaveBeenCalledTimes(5);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
