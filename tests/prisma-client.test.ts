import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { PrismaClient, PrismaPg, Pool, attachDatabasePool } = vi.hoisted(() => ({
  PrismaClient: vi.fn(class {
    $connect = vi.fn();
    $disconnect = vi.fn();
  }),
  PrismaPg: vi.fn(class {}),
  Pool: vi.fn(class { on = vi.fn(); }),
  attachDatabasePool: vi.fn(),
}));

vi.mock("@/lib/generated/prisma/client", () => ({ PrismaClient }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg }));
vi.mock("pg", () => ({ Pool }));
vi.mock("@vercel/functions", () => ({ attachDatabasePool }));

const sharedGlobal = globalThis as typeof globalThis & { shopPrisma?: unknown };
const previousClient = sharedGlobal.shopPrisma;

beforeEach(() => {
  vi.resetModules();
  delete sharedGlobal.shopPrisma;
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/shop_lab08_test");
  vi.stubEnv("VERCEL", undefined);
  vi.stubEnv("VERCEL_ENV", undefined);
  vi.stubEnv("PG_POOL_MAX", undefined);
  vi.stubEnv("PG_IDLE_TIMEOUT_MS", undefined);
  vi.stubEnv("PG_CONNECT_TIMEOUT_MS", undefined);
});

afterEach(() => {
  if (previousClient === undefined) delete sharedGlobal.shopPrisma;
  else sharedGlobal.shopPrisma = previousClient;
  vi.unstubAllEnvs();
});

describe("application Prisma connection ownership", () => {
  it("reuses one adapter and client across development module reloads", async () => {
    const first = await import("@/lib/db/prisma");
    vi.resetModules();
    const second = await import("@/lib/db/prisma");

    expect(second.prisma).toBe(first.prisma);
    expect(Pool).toHaveBeenCalledExactlyOnceWith({
      connectionString: "postgresql://test:test@localhost:5432/shop_lab08_test",
      min: 0, max: 5, idleTimeoutMillis: 5000, connectionTimeoutMillis: 10000,
    });
    expect(PrismaPg).toHaveBeenCalledExactlyOnceWith(Pool.mock.instances[0]);
    expect(attachDatabasePool).not.toHaveBeenCalled();
    expect(PrismaClient).toHaveBeenCalledExactlyOnceWith({ adapter: PrismaPg.mock.instances[0] });
    expect(first.prisma.$connect).not.toHaveBeenCalled();
    expect(first.prisma.$disconnect).not.toHaveBeenCalled();
  });

  it("rejects missing configuration before creating an adapter or client", async () => {
    vi.stubEnv("DATABASE_URL", undefined);
    await expect(import("@/lib/db/prisma")).rejects.toThrow("DATABASE_URL is required");
    expect(PrismaPg).not.toHaveBeenCalled();
    expect(PrismaClient).not.toHaveBeenCalled();
  });

  it("uses normal module reuse in production without storing a development global", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const first = await import("@/lib/db/prisma");
    const second = await import("@/lib/db/prisma");
    expect(second.prisma).toBe(first.prisma);
    expect(sharedGlobal.shopPrisma).toBeUndefined();
    expect(PrismaClient).toHaveBeenCalledOnce();
  });
});
