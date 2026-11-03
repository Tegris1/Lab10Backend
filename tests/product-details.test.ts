import { beforeEach, describe, expect, it, vi } from "vitest";
import Page, { generateMetadata } from "@/app/product-list/[id]/page";
import { parseProductId } from "@/lib/products/product-id";

const { findProductById, listProducts, notFound } = vi.hoisted(() => ({
  findProductById: vi.fn(),
  listProducts: vi.fn(),
  notFound: vi.fn((): never => { throw new Error("NOT_FOUND"); }),
}));

vi.mock("@/lib/products/product-repo", () => ({ findProductById, listProducts }));
vi.mock("@/app/basket/actions", () => ({ addProduct: vi.fn(), setQuantity: vi.fn(), removeItem: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

beforeEach(() => {
  findProductById.mockResolvedValue({ name: "Test CPU", description: "A CPU" });
});

describe("product ID format and boundaries", () => {
  it.each(["abc", "12abc", "0", "-1", "01", "2147483648", "9007199254740992"])(
    "rejects invalid ID %j", id => {
      expect(parseProductId(id)).toBeNull();
    },
  );

  it.each(["1", "2147483647"])("accepts boundary ID %s", id => {
    expect(parseProductId(id)).toBe(Number(id));
  });
});

describe.each([
  ["details", Page],
  ["metadata", generateMetadata],
] as const)("product %s ID validation", (_name, render) => {
  it("rejects an invalid ID before reading the repository", async () => {
    await expect(render({ params: Promise.resolve({ id: "01" }) })).rejects.toThrow("NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
    expect(findProductById).not.toHaveBeenCalled();
  });

  it("returns not found for a valid but unknown ID", async () => {
    findProductById.mockResolvedValue(null);
    await expect(render({ params: Promise.resolve({ id: "123" }) })).rejects.toThrow("NOT_FOUND");
    expect(findProductById).toHaveBeenCalledWith(123);
  });

  it("propagates repository failures instead of treating them as missing products", async () => {
    const failure = new Error("Read failed");
    findProductById.mockRejectedValue(failure);
    await expect(render({ params: Promise.resolve({ id: "1" }) })).rejects.toBe(failure);
    expect(notFound).not.toHaveBeenCalled();
  });
});

it("generates metadata from the requested product", async () => {
  await expect(generateMetadata({ params: Promise.resolve({ id: "1" }) })).resolves.toEqual({
    title: "Test CPU", description: "A CPU",
  });
  expect(findProductById).toHaveBeenCalledWith(1);
  expect(notFound).not.toHaveBeenCalled();
});
