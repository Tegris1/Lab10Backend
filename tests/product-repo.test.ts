import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/app/types/products";
import { findProductById, listProducts } from "@/lib/products/product-repo";

const { readFile } = vi.hoisted(() => ({ readFile: vi.fn() }));
vi.mock("fs", () => ({ readFile }));

const products: Product[] = [
  { id: 1, code: "AAAAAAAA01", name: "Beta", type: "cpu", price: 200, amount: 0,
    description: "CPU", date: "2026-10-01T10:00:00Z", image: "/images/cpu.webp" },
  { id: 2, code: "AAAAAAAA02", name: "Alpha", type: "gpu", price: 100, amount: 3,
    description: "GPU", date: "2026-10-01T10:00:00Z", image: "/images/gpu.webp" },
  { id: 3, code: "AAAAAAAA03", name: "Gamma", type: "cpu", price: 300, amount: 2,
    description: "CPU", date: "2026-10-01T10:00:00Z", image: "/images/cpu.webp" },
];

function useData(data: unknown) {
  readFile.mockImplementation((_path, _encoding, callback) => {
    callback(null, JSON.stringify(data));
  });
}

beforeEach(() => useData(products));

describe("product repository", () => {
  it.each([
    ["nameAsc", [2, 1, 3]],
    ["nameDesc", [3, 1, 2]],
    ["priceAsc", [2, 1, 3]],
    ["priceDesc", [3, 1, 2]],
  ] as const)("sorts by %s without changing the original order", async (sort, ids) => {
    const original = await listProducts();
    expect((await listProducts({ sort })).map(p => p.id)).toEqual(ids);
    expect(original.map(p => p.id)).toEqual([1, 2, 3]);
    expect((await listProducts()).map(p => p.id)).toEqual([1, 2, 3]);
  });

  it("filters available products and combines availability with category", async () => {
    expect((await listProducts({ available: true })).map(p => p.id)).toEqual([2, 3]);
    expect((await listProducts({ available: true, type: "cpu" })).map(p => p.id)).toEqual([3]);
  });

  it("sorts a copy when the input array and products are frozen", async () => {
    const input = Object.freeze(products.map(product => Object.freeze({ ...product })));
    vi.spyOn(JSON, "parse").mockReturnValueOnce(input);
    expect((await listProducts({ sort: "nameAsc" })).map(p => p.id)).toEqual([2, 1, 3]);
    expect(input.map(p => p.id)).toEqual([1, 2, 3]);
  });

  it("returns an empty array for no matches or an empty catalog", async () => {
    expect(await listProducts({ type: "disk" })).toEqual([]);
    useData([]);
    expect(await listProducts()).toEqual([]);
  });

  it("finds a product and returns null for a missing identifier", async () => {
    expect(await findProductById(2)).toEqual(products[1]);
    expect(await findProductById(999)).toBeNull();
  });

  it.each(["id", "code"] as const)("rejects duplicate %s", async (field) => {
    useData([products[0], { ...products[1], [field]: products[0][field] }]);
    await expect(listProducts()).rejects.toThrow();
  });

  it("rejects a negative price and accepts a zero price", async () => {
    useData([{ ...products[0], price: -1 }]);
    await expect(listProducts()).rejects.toThrow();
    useData([{ ...products[0], price: 0 }]);
    expect((await listProducts())[0].price).toBe(0);
  });

  it("propagates read and JSON parsing failures", async () => {
    readFile.mockImplementation((_path, _encoding, callback) => callback(new Error("Read failed")));
    await expect(listProducts()).rejects.toThrow("Read failed");
    readFile.mockImplementation((_path, _encoding, callback) => callback(null, "{invalid"));
    await expect(listProducts()).rejects.toBeInstanceOf(SyntaxError);
  });
});
