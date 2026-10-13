"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { ProductType } from "@/app/types/products";

export default function ProductFilters({ type, available }: {
  type?: ProductType;
  available: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function changeFilter(key: "type" | "available", value: string) {
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
          <select value={type ?? ""} onChange={(event) => changeFilter("type", event.target.value)}>
            <option value="">All categories</option>
            <option value="cpu">CPU</option>
            <option value="gpu">GPU</option>
            <option value="ram">RAM</option>
            <option value="disk">Disk</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={available}
            onChange={(event) => changeFilter("available", event.target.checked ? "true" : "")} />
          In stock only
        </label>
        <button type="button" disabled={!type && !available} onClick={clearFilters}>
          Clear filters
        </button>
      </fieldset>
      <p role="status">{isPending ? "Updating filters…" : ""}</p>
    </div>
  );
}
