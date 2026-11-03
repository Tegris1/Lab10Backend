import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { createCartRepository } from "../lib/cart/prisma-cart-repo";
import { demoUser } from "../lib/orders/demo-user";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }) });
  try {
    console.log(JSON.stringify(await createCartRepository(client).findCartForUser(demoUser.id), null, 2));
  } finally { await client.$disconnect(); }
}

main().catch(() => {
  console.error("Could not load the demonstration cart. Check database availability and migrations.");
  process.exitCode = 1;
});
