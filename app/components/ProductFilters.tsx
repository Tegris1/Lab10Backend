"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { CatalogSort, ProductStock, ProductType } from "@/app/types/products";

export default function ProductFilters({
  type,
  stock,
  sort,
}: {
  type?: ProductType;
  stock: ProductStock;
  sort: CatalogSort;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function changeFilter(key: "type" | "stock", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("type");
    params.delete("stock");
    params.delete("sort");
    params.delete("available");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div>
      <fieldset className="product-filters" disabled={isPending}>
        <legend>Filter products</legend>
        <label>
          Category{" "}
          <select
            value={type ?? "all"}
            onChange={(event) => changeFilter("type", event.target.value)}
          >
            <option value="all">All categories</option>
            <option value="cpu">CPU</option>
            <option value="gpu">GPU</option>
            <option value="ram">RAM</option>
            <option value="disk">Disk</option>
          </select>
        </label>
        <label>
          Stock{" "}
          <select value={stock} onChange={(event) => changeFilter("stock", event.target.value)}>
            <option value="all">All products</option>
            <option value="available">In stock</option>
            <option value="unavailable">Out of stock</option>
          </select>
        </label>
        <button
          type="button"
          disabled={!type && stock === "all" && sort === "name"}
          onClick={clearFilters}
        >
          Clear filters
        </button>
      </fieldset>
      <p role="status">{isPending ? "Updating filters…" : ""}</p>
    </div>
  );
}
