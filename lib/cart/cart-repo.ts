import "server-only";
import { prisma } from "../db/prisma";
import { createCartRepository } from "./prisma-cart-repo";

export const { findCartForUser } = createCartRepository(prisma);
