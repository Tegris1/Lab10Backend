import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { seedOrderHistory } from "../prisma/seed-order-history";
import { getLocalDemoDatabaseURL } from "./lib/demo-database";

async function main() {
  const connectionString = getLocalDemoDatabaseURL();
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }) });
  try {
    await seedOrderHistory(client);
    console.log("Seeded the fictional profile and four orders; catalogue and existing historical snapshots unchanged.");
  } finally { await client.$disconnect(); }
}

main().catch(() => {
  console.error("Order-history seed failed. Check migrations, catalogue availability and conflicting demo identities.");
  process.exitCode = 1;
});
