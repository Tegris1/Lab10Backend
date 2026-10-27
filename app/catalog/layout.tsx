import Link from "next/link";
import type { ReactNode } from "react";

export default function CatalogLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav aria-label="Catalogue views" className="mb-4 flex flex-wrap gap-4 font-sans text-sm font-semibold text-slate-950">
        <Link href="/catalog" className="underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2">All categories</Link>
        <Link href="/catalog/required/cpu" className="underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2">Browse by category</Link>
      </nav>
      {children}
    </>
  );
}
