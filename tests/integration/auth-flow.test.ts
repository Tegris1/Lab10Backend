import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { toNextJsHandler } from "better-auth/next-js";
import { serializeSignedCookie } from "better-call";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { createAuthOptions } from "@/lib/auth/options";

const base = "http://localhost:3000";
const secret = "fictional-oauth-flow-secret-0123456789";
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 1000 }) });
const auth = betterAuth({
  ...createAuthOptions({ secret, baseURL: base, githubClientId: "fixture-client-id", githubClientSecret: "fixture-client-secret",
    databaseURL: process.env.DATABASE_URL! }),
  database: prismaAdapter(client, { provider: "postgresql" }),
  logger: { disabled: true },
});
const handlers = toNextJsHandler(auth);
const cookies = (response: Response) => response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
function request(path: string, body?: object, cookie = "", origin = base) {
  const input = new Request(`${base}/api/auth${path}`, {
    method: body ? "POST" : "GET", headers: { origin, cookie, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return body ? handlers.POST(input) : handlers.GET(input);
}
async function sessionCookie(token: string) {
  const context = await auth.$context;
  const cookie = context.authCookies.sessionToken;
  return (await serializeSignedCookie(cookie.name, token, secret, cookie.attributes)).split(";")[0];
}

beforeAll(async () => {
  const [identity] = await client.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  expect(identity.name).toMatch(/^shop_lab08_test_integration_[a-f0-9]{16}$/);
});
beforeEach(async () => {
  await client.order.deleteMany();
  await client.user.deleteMany();
  await client.verification.deleteMany();
});
afterEach(() => { vi.unstubAllGlobals(); });
afterAll(async () => { await client.$disconnect(); });

describe("GitHub OAuth and database sessions through Next.js handlers", () => {
  it("completes the OAuth callback with a test provider, stores the session, and invalidates it on sign-out", async () => {
    // Only GitHub HTTP responses are replaced; state, callback, cookies and database writes use Better Auth.
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === "https://github.com/login/oauth/access_token") return Response.json({
        access_token: "fictional-provider-token", token_type: "bearer", scope: "read:user user:email",
      });
      if (url === "https://api.github.com/user") return Response.json({
        id: 424242, login: "fictional-customer", name: "OAuth Fixture Customer", email: null,
        avatar_url: "https://example.test/avatar.png",
      });
      if (url === "https://api.github.com/user/emails") return Response.json([
        { email: "oauth-flow@example.test", primary: true, verified: true },
      ]);
      throw new Error("Unexpected provider HTTP request in OAuth test.");
    }));
    const started = await request("/sign-in/social", { provider: "github", callbackURL: "/basket", disableRedirect: true });
    expect(started.status).toBe(200);
    const authorization = new URL((await started.json()).url);
    expect(authorization.origin).toBe("https://github.com");
    const state = authorization.searchParams.get("state");
    expect(state).toBeTruthy();
    const callback = await request(`/callback/github?code=fictional-code&state=${encodeURIComponent(state!)}`, undefined, cookies(started));
    expect(callback.status).toBe(302);
    expect(new URL(callback.headers.get("location")!, base).pathname).toBe("/basket");
    const cookie = cookies(callback);
    const current = await request("/get-session", undefined, cookie);
    expect(current.status).toBe(200);
    expect(current.headers.get("cache-control")).toContain("no-store");
    const data = await current.json();
    expect(data.user).toMatchObject({ name: "OAuth Fixture Customer", email: "oauth-flow@example.test", emailVerified: true });
    expect(await client.account.count({ where: { providerId: "github", userId: data.user.id } })).toBe(1);
    expect(await client.session.count({ where: { userId: data.user.id } })).toBe(1);
    expect(await client.cart.count({ where: { userId: data.user.id } })).toBe(0);
    const signOut = await request("/sign-out", {}, cookie);
    expect(signOut.status).toBe(200);
    expect((await signOut.json()).success).toBe(true);
    expect(await client.session.count()).toBe(0);
    expect(await (await request("/get-session", undefined, cookie)).json()).toBeNull();
    expect(await client.user.count()).toBe(1);
  });

  it("rejects missing, forged, expired and database-revoked sessions", async () => {
    expect(await (await request("/get-session")).json()).toBeNull();
    const context = await auth.$context;
    const user = await client.user.create({ data: { id: "session-fixture-user", name: "Session Fixture", email: "session@example.test" } });
    const session = await context.internalAdapter.createSession(user.id);
    const cookie = await sessionCookie(session.token);
    expect((await (await request("/get-session", undefined, cookie)).json()).user.id).toBe(user.id);
    const forged = `${context.authCookies.sessionToken.name}=forged-session-token`;
    expect(await (await request("/get-session", undefined, forged)).json()).toBeNull();
    await client.session.update({ where: { id: session.id }, data: { expiresAt: new Date("2000-01-01T00:00:00.000Z") } });
    expect(await (await request("/get-session", undefined, cookie)).json()).toBeNull();
    const replacement = await context.internalAdapter.createSession(user.id);
    const replacementCookie = await sessionCookie(replacement.token);
    await client.session.delete({ where: { id: replacement.id } });
    expect(await (await request("/get-session", undefined, replacementCookie)).json()).toBeNull();
  });

  it("rejects foreign origins, external return URLs and a callback with invalid state", async () => {
    const foreign = await request("/sign-in/social", { provider: "github", callbackURL: "/basket" }, "", "https://external.example.test");
    expect(foreign.status).toBe(403);
    const externalReturn = await request("/sign-in/social", { provider: "github", callbackURL: "https://external.example.test" });
    expect(externalReturn.status).toBe(403);
    const callback = await request("/callback/github?code=fictional-code&state=forged-state");
    expect(callback.status).toBe(302);
    expect(new URL(callback.headers.get("location")!, base).pathname).toBe("/sign-in");
    expect(await client.user.count()).toBe(0);
    expect(await client.account.count()).toBe(0);
    expect(await client.session.count()).toBe(0);
  });
});
