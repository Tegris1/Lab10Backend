"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";

export default function NavLink({ href, children }: PropsWithChildren<{ href: string }>) {
  const pathname = usePathname();
  const isCurrentPage = pathname === href;
  const isActive = isCurrentPage || (href !== "/" && pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      className={isActive ? "active" : undefined}
      aria-current={isCurrentPage ? "page" : isActive ? "location" : undefined}
    >
      {children}
    </Link>
  );
}
