"use client";
import type { CatalogSort } from "@/app/types/products";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const sortOptions: { value: CatalogSort; label: string }[] = [
  { value: "name", label: "Name (A–Z)" },
  { value: "newest", label: "Newest first" },
];

export default function SortRadio({ sort }: { sort: CatalogSort }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function changeSort(value: CatalogSort) {
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
