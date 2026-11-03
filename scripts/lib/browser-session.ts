import assert from "node:assert/strict";
import { betterAuth } from "better-auth";
import { serializeSignedCookie } from "better-call";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../lib/generated/prisma/client";
import { parseAuthEnvironment } from "../../lib/auth/environment";
import { createAuthOptions } from "../../lib/auth/options";

// Local test helper only. It is never imported by an application route or seed.
export async function createBrowserSession(baseURL: string, userId: string) {
  const environment = parseAuthEnvironment(process.env);
  const expectedDatabase = new URL(environment.databaseURL).pathname.slice(1);
  assert.match(expectedDatabase, /^shop_lab08_test_browser_[a-f0-9]{16}$/);
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: environment.databaseURL, connectionTimeoutMillis: 1000 }) });
  try {
    const [identity] = await client.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
    assert.equal(identity.name, expectedDatabase);
    const auth = betterAuth({
      ...createAuthOptions({ ...environment, baseURL }),
      database: prismaAdapter(client, { provider: "postgresql" }),
    });
    const context = await auth.$context;
    const session = await context.internalAdapter.createSession(userId);
    const cookie = context.authCookies.sessionToken;
    const serialized = (await serializeSignedCookie(cookie.name, session.token, environment.secret, cookie.attributes)).split(";")[0];
    return { sessionId: session.id, cookie: {
      name: cookie.name, value: serialized.slice(cookie.name.length + 1), url: baseURL,
      path: "/", httpOnly: true, secure: cookie.attributes.secure, sameSite: "Lax" as const,
    } };
  } finally { await client.$disconnect(); }
}
