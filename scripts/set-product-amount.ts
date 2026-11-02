import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { parseStockArguments, setProductAmount } from "../lib/products/product-stock";

async function main() {
  const { id, amount } = parseStockArguments(process.argv.slice(2));
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }) });
  try {
    await setProductAmount(client, id, amount);
    console.log(`Updated product ${id}: amount=${amount}.`);
  } finally { await client.$disconnect(); }
}

main().catch(error => {
  console.error(error instanceof RangeError ? error.message : "Stock update failed. Check database readiness and ensure the product exists.");
  process.exitCode = 1;
});
