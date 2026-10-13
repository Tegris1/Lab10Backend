"use client";

import { useEffect, useState } from "react";
import type { Product, ProductSort, ProductType } from "@/app/types/products";
import SortRadio from "./SortRadio";
import ProductFilters from "./ProductFilters";
import "./product-list.css";

const priceFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
});

type ProductResult = {
  requestKey: string;
} & ({ products: Product[]; error?: never } | { products?: never; error: string });

export default function ProductList({ sort, type, available }: {
  sort: ProductSort;
  type?: ProductType;
  available: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<ProductResult | null>(null);
  const requestKey = `${sort}:${type ?? "all"}:${available}:${attempt}`;
  const currentResult = result?.requestKey === requestKey ? result : null;

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      try {
        const params = new URLSearchParams({ sort });
        if (type) params.set("type", type);
        if (available) params.set("available", "true");
        const response = await fetch(`/api/products?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Products request failed: ${response.status}`);
        }
        const products: Product[] = await response.json();
        if (!controller.signal.aborted) {
          setResult({ requestKey, products });
        }
      } catch {
        if (!controller.signal.aborted) {
          setResult({ requestKey, error: "Unable to load products. Please try again." });
        }
      }
    }

    void loadProducts();
    return () => controller.abort();
  }, [sort, type, available, requestKey]);

  return (
    <main className="product-list">
      <header className="product-list-heading">
        <div>
          <p className="product-list-eyebrow">Computer components</p>
          <h1>Product List</h1>
          <p>Find the right components for your next build.</p>
        </div>
        {currentResult?.products && (
          <span className="product-count" role="status">
            {currentResult.products.length} {currentResult.products.length === 1 ? "product" : "products"}
          </span>
        )}
      </header>
      <div className="product-list-controls">
        <ProductFilters type={type} available={available} />
        <SortRadio sort={sort} />
      </div>
      {currentResult === null ? (
        <p className="product-list-message" role="status">Loading products…</p>
      ) : currentResult.error !== undefined ? (
        <div className="product-list-message product-list-error">
          <p role="alert">{currentResult.error}</p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </button>
        </div>
      ) : currentResult.products.length === 0 ? (
        <p className="product-list-message">{type || available ? "No products match the selected filters." : "Katalog produktów jest pusty."}</p>
      ) : (
        <ul className="product-items" aria-label="Products">
          {currentResult.products.map((product) => (
            <li key={product.id}>
              <article className="product-card">
                <div className="product-card-category">
                  <span>{product.type.toUpperCase()}</span>
                  <span className={`product-stock ${product.amount > 0 ? "product-stock-available" : "product-stock-empty"}`}>
                    {product.amount > 0 ? "In stock" : "Out of stock"}
                  </span>
                </div>
                <h2>{product.name}</h2>
                <p className="product-description">{product.description}</p>
                <footer className="product-card-footer">
                  <span className="product-price">{priceFormatter.format(product.price / 100)}</span>
                  <span className="product-quantity">{product.amount} available</span>
                </footer>
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
