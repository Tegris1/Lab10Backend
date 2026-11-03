import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { createAuthOptions } from "@/lib/auth/options";
import { seedCatalog } from "@/prisma/seed-catalog";
import { seedOrderHistory } from "@/prisma/seed-order-history";
import { seedCart } from "@/prisma/seed-cart";

const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 1000 }) });
const source: unknown = JSON.parse(await readFile(new URL("../../data/products.json", import.meta.url), "utf8"));
const auth = betterAuth({
  ...createAuthOptions({
    secret: "fictional-auth-model-test-secret-0123456789",
    baseURL: "http://localhost:3000",
    githubClientId: "fictional-client-id", githubClientSecret: "fictional-client-secret",
    databaseURL: process.env.DATABASE_URL!,
  }),
  database: prismaAdapter(client, { provider: "postgresql" }),
});

// Test database only: let Better Auth generate IDs and session tokens, without calling GitHub.
async function createAuthRecords() {
  const { internalAdapter } = await auth.$context;
  const { user, account } = await internalAdapter.createOAuthUser({
    name: "Fictional OAuth customer", email: "oauth-fixture@example.test", emailVerified: true, image: null,
  }, {
    providerId: "github", accountId: "fictional-github-account", scope: "read:user user:email",
    accessToken: "fictional-provider-token",
  });
  const session = await internalAdapter.createSession(user.id);
  const verification = await internalAdapter.createVerificationValue({
    identifier: "fictional-oauth-state", value: "fictional-verification-value",
    expiresAt: new Date("2030-01-01T00:00:00.123Z"),
  });
  return { user, account, session, verification };
}

beforeAll(async () => {
  const [identity] = await client.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  expect(identity.name).toMatch(/^shop_lab08_test_integration_[a-f0-9]{16}$/);
});

beforeEach(async () => {
  await client.order.deleteMany();
  await client.user.deleteMany();
  await client.verification.deleteMany();
  await client.product.deleteMany();
  await seedCatalog(client, source);
});

afterAll(async () => { await client.$disconnect(); });

describe("Better Auth models in PostgreSQL", () => {
  it("stores the records written by the pinned Better Auth Prisma adapter against the existing User model", async () => {
    const { user, account, session, verification } = await createAuthRecords();
    expect(typeof user.id).toBe("string");
    expect(user.id).not.toBe(account.accountId);
    const stored = await client.user.findUniqueOrThrow({ where: { id: user.id }, include: { accounts: true, sessions: true } });
    expect(stored).toMatchObject({ name: user.name, email: user.email, emailVerified: true });
    expect(stored.accounts).toHaveLength(1);
    expect(stored.accounts[0]).toMatchObject({ id: account.id, userId: user.id, providerId: "github", password: null });
    expect(stored.sessions).toHaveLength(1);
    expect(stored.sessions[0]).toMatchObject({ id: session.id, userId: user.id, token: session.token });
    expect(await client.verification.findUniqueOrThrow({ where: { id: verification.id } })).toMatchObject({
      identifier: verification.identifier, expiresAt: new Date("2030-01-01T00:00:00.123Z"),
    });
    const { internalAdapter } = await auth.$context;
    expect((await internalAdapter.findSession(session.token))?.user.id).toBe(user.id);
  });

  it("preserves OAuth users, accounts, sessions, verifications and their baskets across repeated demo seeds", async () => {
    const records = await createAuthRecords();
    await client.cart.create({ data: { userId: records.user.id, items: { create: { productId: 4, quantity: 5 } } } });
    const snapshot = async () => ({
      user: await client.user.findUnique({ where: { id: records.user.id } }),
      account: await client.account.findUnique({ where: { id: records.account.id } }),
      session: await client.session.findUnique({ where: { id: records.session.id } }),
      verification: await client.verification.findUnique({ where: { id: records.verification.id } }),
      cart: await client.cart.findUnique({ where: { userId: records.user.id }, include: { items: true } }),
    });
    const before = await snapshot();
    for (let pass = 0; pass < 2; pass++) {
      await seedCatalog(client, source);
      await seedOrderHistory(client);
      await seedCart(client);
      expect(await snapshot()).toEqual(before);
    }
    expect(await client.user.count()).toBe(2);
    expect(await client.session.count()).toBe(1);
    expect(await client.account.count()).toBe(1);
  });

  it("enforces unique session tokens, provider identities and auth foreign keys", async () => {
    const { user, account, session } = await createAuthRecords();
    await expect(client.session.create({ data: { id: "duplicate-session", userId: user.id, token: session.token,
      expiresAt: new Date("2030-01-01T00:00:00.000Z") } })).rejects.toMatchObject({ code: "P2002" });
    await expect(client.account.create({ data: { id: "duplicate-account", providerId: account.providerId,
      accountId: account.accountId, userId: user.id } })).rejects.toMatchObject({ code: "P2002" });
    await expect(client.session.create({ data: { id: "orphan-session", userId: "missing-user", token: "orphan-token",
      expiresAt: new Date("2030-01-01T00:00:00.000Z") } })).rejects.toMatchObject({ code: "P2003" });
    await expect(client.account.create({ data: { id: "orphan-account", providerId: "github",
      accountId: "orphan-account-id", userId: "missing-user" } })).rejects.toMatchObject({ code: "P2003" });
  });

  it("cascades user deletion to accounts, sessions and the user's basket", async () => {
    const { user, session, account } = await createAuthRecords();
    const cart = await client.cart.create({ data: { userId: user.id, items: { create: { productId: 4, quantity: 1 } } } });
    await client.user.delete({ where: { id: user.id } });
    expect(await client.session.findUnique({ where: { id: session.id } })).toBeNull();
    expect(await client.account.findUnique({ where: { id: account.id } })).toBeNull();
    expect(await client.cart.findUnique({ where: { id: cart.id } })).toBeNull();
    expect(await client.cartItem.count({ where: { cartId: cart.id } })).toBe(0);
    const { internalAdapter } = await auth.$context;
    expect(await internalAdapter.findSession(session.token)).toBeNull();
  });
});
