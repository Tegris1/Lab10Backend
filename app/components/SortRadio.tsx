"use client";
import type { ProductSort } from "@/app/types/products";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const sortOptions: { value: ProductSort; label: string }[] = [
  { value: "nameAsc", label: "Name Ascending" },
  { value: "nameDesc", label: "Name Descending" },
  { value: "priceAsc", label: "Price Ascending" },
  { value: "priceDesc", label: "Price Descending" },
];

export default function SortRadio({ sort }: { sort: ProductSort }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function changeSort(value: ProductSort) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div>
      <fieldset disabled={isPending}>
        <legend>Sort options:</legend>
        {sortOptions.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name="sort"
              value={option.value}
              checked={sort === option.value}
              onChange={() => changeSort(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <p role="status">{isPending ? "Sorting products…" : ""}</p>
    </div>
  );
}
