import "dotenv/config";
import { parseArgs } from "node:util";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../lib/generated/prisma/client";
import { prepareOrderSnapshot } from "../lib/orders/order-write";
import { demoOrders } from "../prisma/order-history-fixtures";
import { getLocalDemoDatabaseURL } from "./lib/demo-database";

class DemoHistoryError extends Error {}

function emailArgument(value: string | undefined, flag: string): string {
  if (!value || value.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    throw new DemoHistoryError(`Provide a valid ${flag}. Run with --help for usage.`);
  }
  return value.trim().toLowerCase();
}

async function main() {
  let values;
  try {
    ({ values } = parseArgs({ options: {
      "user-a-email": { type: "string" }, "user-b-email": { type: "string" }, help: { type: "boolean" },
    }, strict: true, allowPositionals: false }));
  } catch { throw new DemoHistoryError("Unknown or incomplete arguments. Run with --help for usage."); }
  if (values.help) {
    console.log("Usage: npm run db:seed-my-orders -- --user-a-email alice@example.com --user-b-email bob@example.com");
    console.log("Both users must first sign in with GitHub in this local development database.");
    console.log("Creates two fixed historical orders per account. Does not transfer orders, change stock, or modify auth data.");
    return;
  }
  const emailA = emailArgument(values["user-a-email"], "--user-a-email");
  const emailB = emailArgument(values["user-b-email"], "--user-b-email");
  if (emailA === emailB) throw new DemoHistoryError("Choose two different GitHub users.");
  let connectionString;
  try { connectionString = getLocalDemoDatabaseURL(); }
  catch { throw new DemoHistoryError("Use a local development PostgreSQL database with DATABASE_URL configured."); }

  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }) });
  try {
    await client.$transaction(async tx => {
      const assignments = [];
      for (const [slot, email] of [["a", emailA], ["b", emailB]] as const) {
        const user = await tx.user.findUnique({
          where: { email }, select: { id: true, accounts: { where: { providerId: "github" }, select: { id: true } } },
        });
        if (!user || user.accounts.length === 0) {
          throw new DemoHistoryError(`User ${slot.toUpperCase()} must sign in with GitHub before preparing history.`);
        }
        assignments.push({ slot, userId: user.id });
      }
      const products = await tx.product.findMany({ where: { id: { in: [1, 2, 3, 4, 5, 6] } }, select: { id: true } });
      const existingProducts = new Set(products.map(product => product.id));
      for (const { slot, userId } of assignments) {
        const fixtures = slot === "a" ? demoOrders.slice(0, 2) : demoOrders.slice(2, 4);
        for (const [index, fixture] of fixtures.entries()) {
          const id = `lab09-history-${slot}-${index + 1}`;
          const number = `LAB09-HISTORY-${slot.toUpperCase()}-${index + 1}`;
          const previous = await tx.order.findUnique({ where: { id }, select: { userId: true, number: true } });
          if (previous) {
            if (previous.userId !== userId || previous.number !== number) {
              throw new DemoHistoryError("Demo history is already assigned to different accounts or has conflicting identities. No data was changed.");
            }
            continue; // Never overwrite snapshots or restore a removed product relation.
          }
          const data = prepareOrderSnapshot({
            ...fixture, id, number, userId,
            items: fixture.items.map(item => ({
              ...item, productId: item.productId !== null && existingProducts.has(item.productId) ? item.productId : null,
            })),
          });
          await tx.order.create({ data });
        }
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    console.log("Prepared two historical orders for each selected GitHub user. Existing snapshots and auth data preserved.");
  } finally { await client.$disconnect(); }
}

main().catch(error => {
  console.error(error instanceof DemoHistoryError ? error.message : "Could not prepare history. Check database availability, applied migrations and conflicting order identities, then retry.");
  process.exitCode = 1;
});
