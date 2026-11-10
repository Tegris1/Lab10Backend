import { afterEach, describe, expect, it, vi } from "vitest";
import { github } from "better-auth/social-providers";
import { AUTH_BASE_PATH, SIGN_IN_CALLBACK_PATH } from "@/lib/auth-paths";
import { getAuthEnvironment } from "@/lib/auth-env";
import { parseAuthEnvironment } from "@/lib/auth/environment";
import { createAuthOptions } from "@/lib/auth/options";

const fixture = {
  BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:3000",
  GITHUB_CLIENT_ID: "fictional-client-id",
  GITHUB_CLIENT_SECRET: "fictional-client-secret",
  DATABASE_URL: "postgresql://fictional:password@localhost:5432/shop_test",
};

afterEach(() => { vi.unstubAllEnvs(); });

describe("auth environment validation", () => {
  it.each(Object.keys(fixture))("rejects missing or blank %s", key => {
    for (const value of [undefined, "", " \t "]) {
      expect(() => parseAuthEnvironment({ ...fixture, [key]: value })).toThrow(`${key} is required`);
    }
  });

  it("allows CI preflight to skip only the secret length check", () => {
    expect(parseAuthEnvironment({ ...fixture, BETTER_AUTH_SECRET: "short" }, { enforceSecretLength: false }).secret)
      .toBe("short");
    expect(() => parseAuthEnvironment({ ...fixture, CI: "true", BETTER_AUTH_SECRET: "short" }))
      .toThrow("at least 32 characters");
    for (const secret of ["", " ", " short "]) {
      expect(() => parseAuthEnvironment({ ...fixture, BETTER_AUTH_SECRET: secret }, { enforceSecretLength: false }))
        .toThrow("BETTER_AUTH_SECRET");
    }
  });

  it("rejects short secrets and leaves credentials out of validation errors", () => {
    expect(() => parseAuthEnvironment({ ...fixture, BETTER_AUTH_SECRET: "short" })).toThrow("at least 32 characters");
    for (const [key, value] of [
      ["BETTER_AUTH_SECRET", "private-short-secret"],
      ["BETTER_AUTH_URL", "https://private:secret@example.test"],
      ["GITHUB_CLIENT_SECRET", " private-client-secret "],
      ["DATABASE_URL", "https://private:secret@example.test/db"],
    ]) {
      try {
        parseAuthEnvironment({ ...fixture, [key]: value });
        expect.fail("Invalid environment was accepted.");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const message = (error as Error).message;
        expect(message).toContain(key);
        expect(message).not.toContain(value);
        expect(message).not.toContain("private");
      }
    }
  });

  it.each(["invalid", "/relative", "ftp://example.test", "https://user:password@example.test",
    "https://example.test/api/auth", "https://example.test?returnTo=https://external.test", "https://example.test#fragment"])(
    "rejects invalid base URL %s", baseURL => {
      expect(() => parseAuthEnvironment({ ...fixture, BETTER_AUTH_URL: baseURL })).toThrow("BETTER_AUTH_URL");
    },
  );

  it.each(["invalid", "https://example.test/db", "postgresql:///db", "postgresql://localhost"])(
    "rejects invalid database URL %s", databaseURL => {
      expect(() => parseAuthEnvironment({ ...fixture, DATABASE_URL: databaseURL })).toThrow("DATABASE_URL");
    },
  );

  it("reads current server variables when called and supports a changed origin", () => {
    for (const [key, value] of Object.entries(fixture)) vi.stubEnv(key, value);
    expect(getAuthEnvironment().baseURL).toBe("http://localhost:3000");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:4000/");
    expect(getAuthEnvironment().baseURL).toBe("http://localhost:4000");
    vi.stubEnv("BETTER_AUTH_URL", "https://shop.example.test/");
    expect(getAuthEnvironment().baseURL).toBe("https://shop.example.test");
  });

  it("does not accept public credential variables instead of server configuration", () => {
    expect(() => parseAuthEnvironment({ ...fixture, GITHUB_CLIENT_SECRET: undefined,
      NEXT_PUBLIC_GITHUB_CLIENT_SECRET: fixture.GITHUB_CLIENT_SECRET })).toThrow("GITHUB_CLIENT_SECRET is required");
  });

  it("accepts the provider's Prisma Postgres connection string in Production", () => {
    const environment = parseAuthEnvironment({ ...fixture, VERCEL_ENV: "production",
      BETTER_AUTH_URL: "https://shop.example.test",
      DATABASE_URL: "postgres://fictional:password@pooled.db.prisma.io:5432/postgres?sslmode=require",
    });
    expect(environment.baseURL).toBe("https://shop.example.test");
  });
});

describe("GitHub OAuth configuration", () => {
  it("builds the provider authorization URL with email access, state and the configured callback", async () => {
    const options = createAuthOptions(parseAuthEnvironment(fixture));
    const callback = `${options.baseURL}${options.basePath}/callback/github`;
    const authorization = await github(options.socialProviders.github).createAuthorizationURL({
      state: "fictional-oauth-state", codeVerifier: "a".repeat(43), redirectURI: callback,
    });
    expect(authorization.origin).toBe("https://github.com");
    expect(authorization.searchParams.get("client_id")).toBe(fixture.GITHUB_CLIENT_ID);
    expect(authorization.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/callback/github");
    expect(authorization.searchParams.get("state")).toBe("fictional-oauth-state");
    expect(new Set(authorization.searchParams.get("scope")?.split(/[ ,]+/))).toEqual(new Set(["read:user", "user:email"]));
    expect(authorization.toString()).not.toContain(fixture.GITHUB_CLIENT_SECRET);
    expect(authorization.toString()).not.toContain(fixture.BETTER_AUTH_SECRET);
    expect(options.trustedOrigins).toEqual([fixture.BETTER_AUTH_URL]);
    expect(options.advanced.disableCSRFCheck).toBe(false);
    expect(options.advanced.disableOriginCheck).toBe(false);
    expect(options.session.storeSessionInDatabase).toBe(true);
    expect(options.session.cookieCache.enabled).toBe(false);
    expect(SIGN_IN_CALLBACK_PATH).toBe("/basket");
    expect(AUTH_BASE_PATH).toBe("/api/auth");
  });
});
