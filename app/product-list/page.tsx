import { parseCatalogQuery, type CatalogSearchParams } from "@/lib/products/catalog-query";
import type { Metadata } from "next";
import ProductList from "@/app/components/ProductList";
import { listProducts } from "@/lib/products/product-repo";

export const metadata: Metadata = { title: "Product List" };

export default async function ProductListPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const { criteria, warnings } = parseCatalogQuery(await searchParams);
  const products = await listProducts(criteria);
  return <ProductList {...criteria} products={products} warnings={warnings} />;
}
