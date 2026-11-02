// Frozen Lab 07 behavior for comparison with the future database adapter.
// Keep this test-only implementation independent of Prisma and production helpers.
import type { CatalogSort, Product, ProductStock, ProductType } from "@/app/types/products";

export type BaselineCriteria = {
  type?: ProductType;
  stock: ProductStock;
  sort: CatalogSort;
};

export function listJsonReference(products: readonly Product[], criteria: BaselineCriteria): Product[] {
  const filtered = products.filter(product =>
    (criteria.type === undefined || product.type === criteria.type) &&
    (criteria.stock === "available" ? product.amount > 0
      : criteria.stock === "unavailable" ? product.amount === 0 : true),
  );

  return filtered.sort(criteria.sort === "newest"
    ? (a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id - b.id
    : (a, b) => Buffer.compare(
      Buffer.from(a.name.normalize("NFC").trim().toLowerCase(), "utf8"),
      Buffer.from(b.name.normalize("NFC").trim().toLowerCase(), "utf8"),
    ) || a.id - b.id);
}
