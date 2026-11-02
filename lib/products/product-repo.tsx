import "server-only";
import { prisma } from "../db/prisma";
import { createProductRepository } from "./prisma-product-repo";

export type { ProductSort } from "../../app/types/products";
export type { ProductQuery } from "./prisma-product-repo";

export const { listProducts, findProductById } = createProductRepository(prisma);
