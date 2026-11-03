import { beforeEach, describe, expect, it, vi } from "vitest";
import CatalogView from "@/app/components/CatalogView";

const { getProductByRouteId, listProducts, notFound } = vi.hoisted(() => ({
  getProductByRouteId: vi.fn(),
  listProducts: vi.fn(),
  notFound: vi.fn((): never => { throw new Error("NOT_FOUND"); }),
}));
vi.mock("@/lib/products/product-details", () => ({ getProductByRouteId }));
vi.mock("@/app/basket/actions", () => ({ addProduct: vi.fn(), setQuantity: vi.fn(), removeItem: vi.fn() }));
vi.mock("@/lib/products/product-repo", () => ({ listProducts }));
vi.mock("next/navigation", () => ({ notFound }));

beforeEach(() => {
  getProductByRouteId.mockResolvedValue({ id: 1, type: "disk" });
  listProducts.mockResolvedValue([]);
});

describe("catalogue category and product validation", () => {
  it("loads the requested category from the shared repository", async () => {
    await CatalogView({ slug: ["cpu"] });
    expect(listProducts).toHaveBeenCalledWith({ type: "cpu", stock: "all", sort: "name" });
  });

  it("accepts a product belonging to the requested category", async () => {
    await CatalogView({ slug: ["disk", "1"] });
    expect(getProductByRouteId).toHaveBeenCalledWith("1");
    expect(notFound).not.toHaveBeenCalled();
  });

  it("rejects an existing product in the wrong category", async () => {
    await expect(CatalogView({ slug: ["cpu", "1"] })).rejects.toThrow("NOT_FOUND");
  });

  it("rejects invalid segments before querying data", async () => {
    await expect(CatalogView({ slug: ["cpu", "01"] })).rejects.toThrow("NOT_FOUND");
    expect(getProductByRouteId).not.toHaveBeenCalled();
    expect(listProducts).not.toHaveBeenCalled();
  });

});
