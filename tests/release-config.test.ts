import { describe, expect, it } from "vitest";
import { productionOrigin, validateReleaseConfiguration } from "../scripts/lib/release-config";

const runtime = {
  DATABASE_URL: "postgres://database-id:private-runtime-password@pooled.db.prisma.io:5432/postgres?sslmode=require",
  BETTER_AUTH_URL: "https://shop.example.test",
  BETTER_AUTH_SECRET: "fictional-auth-secret-with-at-least-32-characters",
  GITHUB_CLIENT_ID: "fictional-client", GITHUB_CLIENT_SECRET: "private-oauth-secret",
};
const release = {
  PRODUCTION_URL: runtime.BETTER_AUTH_URL,
  MIGRATION_DATABASE_URL: runtime.DATABASE_URL.replace("pooled.db.prisma.io", "db.prisma.io"),
};

describe("release configuration before database migrations", () => {
  it("accepts the matching stable origin and direct/pooled Prisma Postgres pair", () => {
    expect(validateReleaseConfiguration(release, runtime)).toBe(runtime.BETTER_AUTH_URL);
  });

  it("skips the auth secret length check only for CI preflight", () => {
    const shortSecretRuntime = { ...runtime, BETTER_AUTH_SECRET: "short" };
    expect(validateReleaseConfiguration({ ...release, CI: "true" }, shortSecretRuntime))
      .toBe(runtime.BETTER_AUTH_URL);
    expect(() => validateReleaseConfiguration(release, shortSecretRuntime)).toThrow("at least 32 characters");
    expect(() => validateReleaseConfiguration({ ...release, CI: "true" }, { ...runtime, BETTER_AUTH_SECRET: "" }))
      .toThrow("BETTER_AUTH_SECRET is required");
  });

  it("blocks an OAuth origin mismatch before publication", () => {
    expect(() => validateReleaseConfiguration({ ...release, PRODUCTION_URL: "https://another.example.test" }, runtime))
      .toThrow("BETTER_AUTH_URL must match");
  });

  it.each([undefined, "http://localhost:3000", "https://user:private-password@shop.example.test", "https://shop.example.test/path"])(
    "rejects malformed or insecure Production origins", origin => {
      expect(() => productionOrigin(origin)).toThrow("origin");
    },
  );

  it("requires a separate migration setting and blocks the pooler", () => {
    expect(() => validateReleaseConfiguration({ ...release, MIGRATION_DATABASE_URL: undefined }, runtime)).toThrow("MIGRATION_DATABASE_URL");
    expect(() => validateReleaseConfiguration({ ...release, MIGRATION_DATABASE_URL: runtime.DATABASE_URL }, runtime)).toThrow("direct Prisma Postgres endpoint");
  });

  it("rejects a different Prisma database even though the shared hostname and database name match", () => {
    expect(() => validateReleaseConfiguration({ ...release,
      MIGRATION_DATABASE_URL: release.MIGRATION_DATABASE_URL.replace("database-id:", "another-database-id:"),
    }, runtime)).toThrow("same database");
  });

  it("validates the runtime pool configuration and omits all credentials from errors", () => {
    expect(() => validateReleaseConfiguration(release, { ...runtime, PG_POOL_MAX: "0" })).toThrow("PG_POOL_MAX");
    try {
      validateReleaseConfiguration({ ...release, MIGRATION_DATABASE_URL: "prisma+postgres://host/?api_key=private-key" }, runtime);
      expect.fail("Accelerate URL accepted for migration");
    } catch (error) {
      const message = (error as Error).message;
      for (const secret of ["private-key", "private-runtime-password", "private-oauth-secret"]) expect(message).not.toContain(secret);
    }
  });
});
