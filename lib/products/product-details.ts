import "server-only";
import { notFound } from "next/navigation";
import { findProductById } from "./product-repo";
import { parseProductId } from "./product-id";

export async function getProductByRouteId(raw: string) {
  const id = parseProductId(raw);
  if (id === null) notFound();
  const product = await findProductById(id);
  if (!product) notFound();
  return product;
}
