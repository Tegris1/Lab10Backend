import type { CatalogSort, ProductStock, ProductType } from "@/app/types/products";

export type CatalogSearchParams = Record<string, string | string[] | undefined>;

export type CatalogCriteria = {
  type?: ProductType;
  stock: ProductStock;
  sort: CatalogSort;
};

export function parseCatalogQuery(params: CatalogSearchParams): {
  criteria: CatalogCriteria;
  warnings: string[];
} {
  const warnings: string[] = [];

  function readSetting<T extends string>(
    key: string,
    allowed: readonly T[],
    fallback: T,
    label: string,
    defaultLabel: string,
  ): T {
    const raw = params[key];
    if (raw === undefined) return fallback;
    const value = allowed.find((option) => option === raw);
    if (value !== undefined) return value;
    warnings.push(`Ignored invalid ${label} setting (${key}); using ${defaultLabel}.`);
    return fallback;
  }

  const type = readSetting<ProductType | "all">(
    "type", ["all", "cpu", "gpu", "ram", "disk"], "all", "category", "all categories",
  );
  const stock = readSetting<ProductStock>(
    "stock", ["all", "available", "unavailable"], "all", "stock", "all products",
  );
  const sort = readSetting<CatalogSort>(
    "sort", ["name", "newest"], "name", "sort", "name order",
  );

  return {
    criteria: { type: type === "all" ? undefined : type, stock, sort },
    warnings,
  };
}
