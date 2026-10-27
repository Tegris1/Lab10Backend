import Link from "next/link";

export default function ProductNotFound() {
  return (
    <main>
      <h1>404 — Product not found</h1>
      <p>The product address is invalid or this product does not exist.</p>
      <Link href="/product-list">← Back to product list</Link>
    </main>
  );
}
