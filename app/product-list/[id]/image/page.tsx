import Link from "next/link";
import { getProductByRouteId } from "@/lib/products/product-details";
import ProductImage from "@/app/components/ProductImage";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const product = await getProductByRouteId(id);
  return { title: `${product.name} — Image` };
}

export default async function ProductImagePage({ params }: Props) {
  const { id } = await params;
  const product = await getProductByRouteId(id);
  return (
    <main className="rounded-2xl bg-white p-5 font-sans text-slate-900 sm:p-8">
      <h1 className="mb-6 text-2xl font-bold">{product.name} — Image</h1>
      <ProductImage product={product} />
      <Link href={`/product-list/${product.id}`} className="mt-6 inline-block font-semibold text-indigo-700 underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo-700">Back to product details</Link>
    </main>
  );
}
