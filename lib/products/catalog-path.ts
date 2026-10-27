import type { ProductType } from "@/app/types/products";
import { parseProductId } from "./product-id";

export type CatalogPath = { type?: ProductType; id?: number };

export function parseCatalogPath(slug: string[] | undefined, required = false): CatalogPath | null {
  if (!slug?.length) return required ? null : {};
  if (slug.length > 2) return null;
  const type = (["cpu", "gpu", "ram", "disk"] as const).find(value => value === slug[0]);
  if (!type) return null;
  if (slug.length === 1) return { type };
  const id = parseProductId(slug[1]);
  return id === null ? null : { type, id };
}
