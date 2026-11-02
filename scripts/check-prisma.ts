import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

async function checkPrismaConnection() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  // Standalone scripts own their client; do not import the server-only app module.
  const adapter = new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 });
  const client = new PrismaClient({ adapter });
  try {
    const [database] = await client.$queryRaw<{ database: string; username: string }[]>`
      SELECT current_database() AS database, current_user AS username
    `;
    if (database?.database !== process.env.POSTGRES_DB || database.username !== process.env.POSTGRES_USER) {
      throw new Error("Unexpected database identity.");
    }
    console.log(`Prisma connection verified: ${database.database}, user ${database.username}.`);
  } finally {
    await client.$disconnect();
  }
}

checkPrismaConnection().catch(() => {
  // Do not print Prisma exceptions: connection diagnostics can contain credentials.
  console.error("Prisma connection check failed. Check DATABASE_URL, database health and run db:generate.");
  process.exitCode = 1;
});
