import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { ProductValidationError } from "../lib/products/product-validation";
import { seedCatalog } from "./seed-catalog";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  const input: unknown = JSON.parse(await readFile(new URL("../data/products.json", import.meta.url), "utf8"));
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }),
  });
  try {
    await seedCatalog(client, input);
    console.log("Seeded four categories and 100 products; users, sessions, baskets and orders preserved.");
  } finally {
    await client.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof ProductValidationError
    ? `Catalogue validation failed: ${error.message}`
    : "Database seed failed. Check the JSON fixture, migrations and conflicting catalogue identities.");
  process.exitCode = 1;
});
