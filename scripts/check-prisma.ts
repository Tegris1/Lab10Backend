import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { getDatabasePoolConfig } from "../lib/db/environment";
import { logServerError } from "../lib/logging";

async function checkPrismaConnection() {
  let poolConfig;
  try { poolConfig = getDatabasePoolConfig(process.env); }
  catch (error) {
    // These are our own validation errors, which never contain credential values.
    console.error(error instanceof Error ? error.message : "Invalid database configuration.");
    process.exitCode = 1;
    return;
  }

  // Standalone scripts own their client; do not import the server-only app module.
  const adapter = new PrismaPg(poolConfig);
  const client = new PrismaClient({ adapter });
  try {
    const counts = await client.$transaction(async transaction => {
      await transaction.$executeRaw`SET TRANSACTION READ ONLY`;
      const categories = await transaction.category.count();
      const products = await transaction.product.count();
      // Check the tables used by GitHub OAuth without returning any user data.
      await transaction.user.count();
      await transaction.account.count();
      await transaction.session.count();
      await transaction.verification.count();
      return { categories, products };
    }, { maxWait: 10000, timeout: 15000 });
    console.log(`Prisma connection and catalogue/auth table reads verified: ${counts.categories} categories, ${counts.products} products.`);
    if (counts.products === 0) {
      console.error("The database is reachable but the catalogue is empty. For initial setup, run npm run db:seed with the migration/owner connection for this same database.");
      process.exitCode = 1;
    }
  } finally {
    await client.$disconnect();
  }
}

checkPrismaConnection().catch(error => {
  // Do not print Prisma exceptions: connection diagnostics can contain credentials.
  logServerError("database.prisma-check", error);
  console.error("Prisma connection/table check failed. Check DATABASE_URL, provider health, applied migrations and table permissions; run db:generate after schema changes.");
  process.exitCode = 1;
});
