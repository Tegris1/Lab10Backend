import type { ProductSort, ProductType } from "@/app/types/products";
import type { Metadata } from "next";
import ProductList from "@/app/components/ProductList";

export const metadata: Metadata = { title: "Product List" };

export default async function ProductListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { sort: requestedSort, type: requestedType, available: requestedAvailable } = await searchParams;
  const sort: ProductSort =
    requestedSort === "nameAsc" ||
    requestedSort === "nameDesc" ||
    requestedSort === "priceAsc" ||
    requestedSort === "priceDesc"
      ? requestedSort
      : "nameAsc";
  const type: ProductType | undefined =
    requestedType === "cpu" || requestedType === "gpu" ||
    requestedType === "ram" || requestedType === "disk"
      ? requestedType
      : undefined;
  return <ProductList sort={sort} type={type} available={requestedAvailable === "true"} />;
}
