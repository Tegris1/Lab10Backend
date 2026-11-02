import type { PrismaClient } from "../generated/prisma/client";
import { parseProductId, requireProductId } from "./product-id";

export function parseStockArguments(args: string[]): { id: number; amount: number } {
  const id = args.length === 2 ? parseProductId(args[0]) : null;
  const amount = Number(args[1]);
  if (id === null || !/^(0|[1-9][0-9]*)$/.test(args[1] ?? "") || !Number.isInteger(amount) || amount > 2147483647) {
    throw new RangeError("Usage: db:set-stock -- <id: 1..2147483647> <amount: 0..2147483647>.");
  }
  return { id, amount };
}

export async function setProductAmount(client: PrismaClient, id: number, amount: number): Promise<void> {
  requireProductId(id);
  if (!Number.isInteger(amount) || amount < 0 || amount > 2147483647) throw new RangeError("Stock must be an integer between 0 and 2147483647.");
  const result = await client.product.updateMany({ where: { id }, data: { amount } });
  if (result.count !== 1) throw new Error("Expected exactly one existing product to be updated.");
}
