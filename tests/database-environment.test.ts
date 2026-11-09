import { describe, expect, it } from "vitest";
import { Client } from "pg";
import { getDatabasePoolConfig, parseDatabaseURL } from "@/lib/db/environment";

const providerURL = "postgres://fictional:password@pooled.db.prisma.io:5432/postgres?sslmode=require";

describe("database connection configuration", () => {
  it("accepts the Prisma Postgres URL and retains certificate and hostname verification in pg", () => {
    const config = getDatabasePoolConfig({ DATABASE_URL: providerURL, VERCEL: "1", VERCEL_ENV: "production" });
    const url = new URL(config.connectionString!);
    expect(url.hostname).toBe("pooled.db.prisma.io");
    expect(url.searchParams.get("sslmode")).toBe("verify-full");
    expect(config.max).toBe(3);
    // Exercise the real driver's parsing; no network connection is opened.
    const client = new Client(config);
    expect(client.ssl).toBeTruthy();
    expect(client.ssl).not.toHaveProperty("rejectUnauthorized", false);
    expect(client.ssl).not.toHaveProperty("checkServerIdentity");
  });

  it("preserves encoded credentials and provider query parameters when normalizing TLS", () => {
    const url = parseDatabaseURL("postgresql://user:p%40ss%3Aword@db.prisma.io:5432/postgres?sslmode=require&application_name=shop");
    expect(decodeURIComponent(url.password)).toBe("p@ss:word");
    expect(url.searchParams.get("application_name")).toBe("shop");
    expect(url.searchParams.get("sslmode")).toBe("verify-full");
  });

  it("accepts explicit verify-full and local development without TLS", () => {
    expect(parseDatabaseURL(providerURL.replace("require", "verify-full")).searchParams.get("sslmode")).toBe("verify-full");
    expect(getDatabasePoolConfig({ DATABASE_URL: "postgresql://user:password@localhost:5432/shop" }).connectionString)
      .toBe("postgresql://user:password@localhost:5432/shop");
    expect(() => parseDatabaseURL("postgresql://localhost:5432/shop", true)).toThrow("remote database");
  });

  it.each([
    "", "?sslmode=disable", "?sslmode=no-verify", "?sslmode=prefer",
    "?sslmode=require&ssl=false", "?sslmode=require&uselibpqcompat=true",
    "?sslmode=require&sslmode=disable", "?sslmode=verify-full&host=localhost",
  ])("rejects insecure or ambiguous remote configuration %s", query => {
    expect(() => parseDatabaseURL(`postgres://user:password@db.prisma.io/postgres${query}`)).toThrow("DATABASE_URL");
  });

  it.each(["prisma", "prisma+postgres"])("explains how to replace an unsupported %s URL without revealing its API key", protocol => {
    try {
      parseDatabaseURL(`${protocol}://accelerate.prisma-data.net/?api_key=private-api-key`);
      expect.fail("Accelerate URL was accepted by the TCP adapter.");
    } catch (error) {
      expect((error as Error).message).toContain("PostgreSQL TCP connection string");
      expect((error as Error).message).not.toContain("private-api-key");
    }
  });
});
