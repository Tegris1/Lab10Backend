import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { PrismaClient, PrismaPg } = vi.hoisted(() => ({
  PrismaClient: vi.fn(class {
    $connect = vi.fn();
    $disconnect = vi.fn();
  }),
  PrismaPg: vi.fn(class {}),
}));

vi.mock("@/lib/generated/prisma/client", () => ({ PrismaClient }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg }));

const sharedGlobal = globalThis as typeof globalThis & { shopPrisma?: unknown };
const previousClient = sharedGlobal.shopPrisma;

beforeEach(() => {
  vi.resetModules();
  delete sharedGlobal.shopPrisma;
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/shop_lab08_test");
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
    expect(PrismaPg).toHaveBeenCalledExactlyOnceWith({
      connectionString: "postgresql://test:test@localhost:5432/shop_lab08_test",
      connectionTimeoutMillis: 5000,
    });
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
