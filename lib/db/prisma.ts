import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  shopPrisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the database connection.");
  }

  const adapter = new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.shopPrisma ?? createPrismaClient();

// Next.js reloads modules during development. Reuse the existing connection pool.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.shopPrisma = prisma;
}
