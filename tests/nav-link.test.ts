import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import NavLink from "@/app/components/NavLink";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname }));

describe("active navigation", () => {
  it.each([
    ["/product-list", "/product-list", "page"],
    ["/product-list/1", "/product-list", "location"],
    ["/product-list-extra", "/product-list", undefined],
    ["/", "/", "page"],
    ["/product-list", "/", undefined],
    ["/catalog", "/catalog", "page"],
    ["/catalog/disk/1", "/catalog", "location"],
    ["/catalogue", "/catalog", undefined],
  ])("pathname %s for link %s has aria-current %s", (pathname, href, current) => {
    usePathname.mockReturnValue(pathname);
    const html = renderToStaticMarkup(createElement(NavLink, { href }, "Navigation"));
    expect(html).toContain(`href="${href}"`);
    if (current) {
      expect(html).toContain(`aria-current="${current}"`);
      expect(html).toContain('class="active"');
    } else {
      expect(html).not.toContain("aria-current");
      expect(html).not.toContain('class="active"');
    }
  });
});
