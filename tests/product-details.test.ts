import { beforeEach, describe, expect, it, vi } from "vitest";
import Page, { dynamicParams, generateMetadata, generateStaticParams } from "@/app/product-list/[id]/page";
import { parseProductId } from "@/lib/products/product-id";

const { findProductById, listProducts, notFound } = vi.hoisted(() => ({
  findProductById: vi.fn(),
  listProducts: vi.fn(),
  notFound: vi.fn((): never => { throw new Error("NOT_FOUND"); }),
}));

vi.mock("@/lib/products/product-repo", () => ({ findProductById, listProducts }));
vi.mock("next/navigation", () => ({ notFound }));

beforeEach(() => {
  findProductById.mockResolvedValue({ name: "Test CPU", description: "A CPU" });
});

describe("product prerendering experiment", () => {
  it("chooses the three lowest IDs deterministically without mutating repository results", async () => {
    const products = Object.freeze([9, 3, 1, 4, 2].map(id => Object.freeze({ id })));
    listProducts.mockResolvedValue(products);
    expect(await generateStaticParams()).toEqual([{ id: "1" }, { id: "2" }, { id: "3" }]);
    expect(products.map(p => p.id)).toEqual([9, 3, 1, 4, 2]);
    expect(dynamicParams).toBe(true);
  });

  it("handles a catalogue smaller than the prerender subset", async () => {
    listProducts.mockResolvedValue([{ id: 9 }]);
    expect(await generateStaticParams()).toEqual([{ id: "9" }]);
    listProducts.mockResolvedValue([]);
    expect(await generateStaticParams()).toEqual([]);
  });

  it("propagates a repository failure instead of building an incomplete subset", async () => {
    const failure = new Error("Read failed during prerender selection");
    listProducts.mockRejectedValue(failure);
    await expect(generateStaticParams()).rejects.toBe(failure);
  });
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
