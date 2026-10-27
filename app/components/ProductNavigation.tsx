"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { ProductDetailsSkeleton, ProductListSkeleton } from "./ProductSkeleton";

type View = "list" | "details";
const NavigationContext = createContext<((href: string, view: View) => void) | null>(null);

// Receives server-rendered children, not the product data or repository.
export default function ProductNavigation({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [target, setTarget] = useState<View>("details");

  function navigate(href: string, view: View) {
    setTarget(view);
    startTransition(() => router.push(href));
  }

  return (
    <NavigationContext.Provider value={navigate}>
      {isPending
        ? target === "details" ? <ProductDetailsSkeleton /> : <ProductListSkeleton />
        : children}
    </NavigationContext.Provider>
  );
}

export function ProductPageLink({ href, view, children, className }: {
  href: string;
  view: View;
  children: ReactNode;
  className?: string;
}) {
  const navigate = useContext(NavigationContext);
  return (
    <Link href={href} className={className} onNavigate={(event) => {
      if (navigate) {
        event.preventDefault();
        navigate(href, view);
      }
    }}>
      {children}
    </Link>
  );
}
