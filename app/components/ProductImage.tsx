import Image from "next/image";
import type { Product } from "@/app/types/products";

export default function ProductImage({ product }: { product: Product }) {
  return (
    <figure>
      <Image src={product.image} alt={`${product.type.toUpperCase()} component illustration`}
        width={1200} height={750} sizes="(max-width: 768px) 92vw, 900px" priority
        className="max-h-[65dvh] w-full rounded-xl bg-slate-50 object-contain" />
      <figcaption className="mt-3 text-sm text-slate-600">Category illustration; actual product appearance may vary.</figcaption>
    </figure>
  );
}
