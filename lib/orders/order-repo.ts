import "server-only";
import { prisma } from "../db/prisma";
import { createOrderRepository } from "./prisma-order-repo";

export const { listOrdersForUser } = createOrderRepository(prisma);
