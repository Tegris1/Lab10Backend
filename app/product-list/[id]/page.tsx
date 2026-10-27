import { findProductById, listProducts } from "@/lib/products/product-repo";
import { notFound } from "next/navigation";
import ProductDetails from "@/app/components/ProductDetails";
import { parseProductId } from "@/lib/products/product-id";
import type { Metadata } from "next";
import { cache } from "react";

type PageProps = {
  params: Promise<{ id: string }>;
};

// Lab 07 experiment: prerender a small subset; other valid IDs render on demand.
// Before Lab 08, remove this experiment and require fresh database reads per request.
export const dynamicParams = true;

export async function generateStaticParams(): Promise<{ id: string }[]> {
  const products = await listProducts();
  return [...products]
    .sort((a, b) => a.id - b.id)
    .slice(0, 3)
    .map((product) => ({ id: String(product.id) }));
}

const getProductDetails = cache(async (id: string) => {
  const productId = parseProductId(id);
  if (productId === null) notFound();

  const productDetails = await findProductById(productId);

  if (!productDetails) {
    notFound();
  }

  return productDetails;
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductDetails(id);
  return { title: product.name, description: product.description };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const productDetails = await getProductDetails(id);
  return <ProductDetails product={productDetails} />;
}
