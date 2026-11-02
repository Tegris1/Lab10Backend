import { connection } from "next/server";
import type { Metadata } from "next";
import ProductDetails from "@/app/components/ProductDetails";
import { getProductByRouteId } from "@/lib/products/product-details";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  await connection();
  const { id } = await params;
  const product = await getProductByRouteId(id);
  return { title: product.name, description: product.description };
}

export default async function Page({ params }: PageProps) {
  await connection();
  const { id } = await params;
  return <ProductDetails product={await getProductByRouteId(id)} />;
}
