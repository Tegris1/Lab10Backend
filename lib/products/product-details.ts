import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { findProductById } from "./product-repo";
import { parseProductId } from "./product-id";

export const getProductByRouteId = cache(async (raw: string) => {
  const id = parseProductId(raw);
  if (id === null) notFound();
  const product = await findProductById(id);
  if (!product) notFound();
  return product;
});
