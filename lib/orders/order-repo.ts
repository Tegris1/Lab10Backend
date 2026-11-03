import "server-only";
import { prisma } from "../db/prisma";
import { createOrderRepository } from "./prisma-order-repo";
import { databaseRead } from "../db/read";

const repository = createOrderRepository(prisma);
export const listOrdersForUser = (userId: string) => databaseRead("orders.list", () => repository.listOrdersForUser(userId));
export const findOrderForUser = (userId: string, orderId: unknown) => databaseRead("orders.find", () => repository.findOrderForUser(userId, orderId));
