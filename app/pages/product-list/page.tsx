import { listProducts } from "@/lib/products/product-repo";
import type { ProductSort } from "@/app/types/products";
import type { Metadata } from "next";
import SortRadio from "@/app/components/SortRadio";

export const metadata: Metadata = { title: "Product List" };

export default async function ProductList({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { sort: requestedSort } = await searchParams;
  const sort: ProductSort =
    requestedSort === "nameAsc" ||
    requestedSort === "nameDesc" ||
    requestedSort === "priceAsc" ||
    requestedSort === "priceDesc"
      ? requestedSort
      : "nameAsc";
  const products = await listProducts({ sort });

  return (
    <main>
      <h1>Product List</h1>

      <SortRadio sort={sort} />
      {products.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Type</th>
              <th scope="col">Price</th>
              <th scope="col">Stock</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.type}</td>
                <td>{product.price}</td>
                <td>{product.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
