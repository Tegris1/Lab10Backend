import { Prisma, type PrismaClient, type Product as StoredProduct } from "../generated/prisma/client";
import type { Product, ProductSort, ProductStock, ProductType } from "../../app/types/products";
import { requireProductId } from "./product-id";

export type ProductQuery = { sort?: ProductSort; available?: boolean; stock?: ProductStock; type?: ProductType };

function toProduct(row: StoredProduct): Product {
  if (!["cpu", "gpu", "ram", "disk"].includes(row.categoryCode)) throw new Error("Invalid stored category");
  return {
    id: row.id, code: row.code, name: row.name, type: row.categoryCode as ProductType,
    price: row.price, amount: row.amount, description: row.description,
    date: row.date.toISOString(), image: row.image,
  };
}

export function createProductRepository(client: PrismaClient) {
  return {
    async listProducts(options: ProductQuery = {}): Promise<Product[]> {
      const { type, stock, available, sort } = options;
      if (type !== undefined && !["cpu", "gpu", "ram", "disk"].includes(type)) throw new RangeError("Invalid category");
      if (stock !== undefined && !["all", "available", "unavailable"].includes(stock)) throw new RangeError("Invalid stock filter");
      if (sort !== undefined && !["name", "newest", "nameAsc", "nameDesc", "priceAsc", "priceDesc"].includes(sort)) throw new RangeError("Invalid sort order");
      const amount = stock === "available" ? { gt: 0 } : stock === "unavailable" ? 0
        : stock === "all" || !available ? undefined : { gt: 0 };
      const where: Prisma.ProductWhereInput = { categoryCode: type, amount };
      if (sort === "nameAsc" || sort === "nameDesc") {

        const conditions = [Prisma.sql`TRUE`];
        if (type !== undefined) conditions.push(Prisma.sql`"categoryCode" = ${type}`);
        if (typeof amount === "number") conditions.push(Prisma.sql`"amount" = ${amount}`);
        else if (amount) conditions.push(Prisma.sql`"amount" > 0`);
        const direction = sort === "nameAsc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
        const rows = await client.$queryRaw<StoredProduct[]>(Prisma.sql`
          SELECT * FROM "Product" WHERE ${Prisma.join(conditions, " AND ")}
          ORDER BY "name" COLLATE "pl-PL-x-icu" ${direction}, "id" ASC
        `);
        return rows.map(toProduct);
      }
      const orderBy: Prisma.ProductOrderByWithRelationInput[] = sort === "name"
        ? [{ nameSortKey: "asc" }, { id: "asc" }]
        : sort === "newest" ? [{ date: "desc" }, { id: "asc" }]
        : sort === "priceAsc" ? [{ price: "asc" }, { id: "asc" }]
        : sort === "priceDesc" ? [{ price: "desc" }, { id: "asc" }] : [{ id: "asc" }];
      return (await client.product.findMany({ where, orderBy })).map(toProduct);
    },
    async findProductById(id: number): Promise<Product | null> {
      requireProductId(id);
      const product = await client.product.findUnique({ where: { id } });
      return product ? toProduct(product) : null;
    },
  };
}
