import type { PrismaClient } from "../lib/generated/prisma/client";
import { stat } from "node:fs/promises";
import { getProductNameSortKey } from "../lib/products/product-name";
import { parseProducts, ProductValidationError } from "../lib/products/product-validation";

export const catalogCategories = [
  { code: "cpu", name: "Procesory" },
  { code: "gpu", name: "Karty graficzne" },
  { code: "ram", name: "Pamięć RAM" },
  { code: "disk", name: "Dyski" },
] as const;

export async function seedCatalog(client: PrismaClient, input: unknown): Promise<void> {
  // Validate every record before constructing any database operation.
  const products = parseProducts(input, { requireCanonicalDates: true });
  if (products.length !== 100 || new Set(products.map(product => product.type)).size !== 4) {
    throw new ProductValidationError("The demonstration seed requires 100 products covering all four categories.");
  }
  try {
    await Promise.all([...new Set(products.map(product => product.image))].map(async image => {
      if (!(await stat(new URL(`../public${image}`, import.meta.url))).isFile()) {
        throw new Error("Expected an image file");
      }
    }));
  } catch {
    throw new ProductValidationError("Every catalogue image must refer to an existing file under public.");
  }

  await client.$transaction([
    ...catalogCategories.map(category => client.category.upsert({
      where: { code: category.code },
      create: category,
      update: { name: category.name },
    })),
    ...products.map(({ type, date, ...fields }) => {
      const data = {
        ...fields,
        categoryCode: type,
        date: new Date(date),
        nameSortKey: getProductNameSortKey(fields.name),
      };
      return client.product.upsert({ where: { id: data.id }, create: data, update: data });
    }),
  ]);
}
