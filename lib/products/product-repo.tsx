import "server-only";
import { prisma } from "../db/prisma";
import { createProductRepository, type ProductQuery } from "./prisma-product-repo";
import { databaseRead } from "../db/read";

export type { ProductSort } from "../../app/types/products";
export type { ProductQuery } from "./prisma-product-repo";

const repository = createProductRepository(prisma);
export const listProducts = (options: ProductQuery = {}) => databaseRead("products.list", () => repository.listProducts(options));
export const findProductById = (id: number) => databaseRead("products.find", () => repository.findProductById(id));
