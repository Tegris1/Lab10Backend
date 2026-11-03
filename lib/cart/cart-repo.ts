import "server-only";
import { prisma } from "../db/prisma";
import { createCartRepository } from "./prisma-cart-repo";
import { databaseRead } from "../db/read";

const repository = createCartRepository(prisma);
export const findCartForUser = (userId: string) => databaseRead("basket.read", () => repository.findCartForUser(userId));
