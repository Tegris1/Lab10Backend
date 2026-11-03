import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { seedCart } from "../prisma/seed-cart";
import { getLocalDemoDatabaseURL } from "./lib/demo-database";

async function main() {
  const connectionString = getLocalDemoDatabaseURL();
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }) });
  try {
    await seedCart(client);
    console.log("Seeded the demonstration cart; catalogue, order history and existing cart quantities unchanged.");
  } finally { await client.$disconnect(); }
}

main().catch(() => {
  console.error("Cart seed failed. Check migrations, catalogue availability and conflicting demo identities.");
  process.exitCode = 1;
});
