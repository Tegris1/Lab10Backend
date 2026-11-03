import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { seedCart } from "../prisma/seed-cart";
import { seedOrderHistory } from "../prisma/seed-order-history";
import { getLocalDemoDatabaseURL } from "./lib/demo-database";

async function main() {
  const connectionString = getLocalDemoDatabaseURL();
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }) });
  try {
    await seedOrderHistory(client);
    await seedCart(client);
    console.log("Seeded local Lab 08 demo fixtures; catalogue, OAuth accounts and sessions preserved.");
  } finally { await client.$disconnect(); }
}

main().catch(() => {
  console.error("Demo seed failed. Use a local development database with an existing catalogue and applied migrations.");
  process.exitCode = 1;
});
