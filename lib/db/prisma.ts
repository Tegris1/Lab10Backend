import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { getDatabasePoolConfig } from "./environment";
import { logServerError } from "../logging";

const globalForPrisma = globalThis as unknown as {
  shopPrisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const pool = new Pool(getDatabasePoolConfig(process.env));
  pool.on("error", error => logServerError("database.pool", error));
  if (process.env.VERCEL === "1") attachDatabasePool(pool);
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.shopPrisma ?? createPrismaClient();

// Next.js reloads modules during development. Reuse the existing connection pool.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.shopPrisma = prisma;
}
