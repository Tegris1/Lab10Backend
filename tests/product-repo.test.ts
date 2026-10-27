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
  it("combines category, stock and catalogue sorting", async () => {
    expect((await listProducts({ type: "cpu", stock: "available", sort: "newest" })).map(p => p.id)).toEqual([3]);
    expect((await listProducts({ type: "cpu", stock: "unavailable", sort: "name" })).map(p => p.id)).toEqual([1]);
    expect((await listProducts({ stock: "all", sort: "name" })).map(p => p.id)).toEqual([2, 1, 3]);
  });

  it("sorts newest by timestamp descending, then ID ascending, without mutating input", async () => {
    const input = Object.freeze([
      Object.freeze({ ...products[2], date: "2026-10-02T12:00:00+02:00" }),
      Object.freeze({ ...products[1], date: "2026-10-01T10:00:00Z" }),
      Object.freeze({ ...products[0], date: "2026-10-02T10:00:00Z" }),
    ]);
    vi.spyOn(JSON, "parse").mockReturnValueOnce(input);
    expect((await listProducts({ sort: "newest" })).map(p => p.id)).toEqual([1, 3, 2]);
    expect(input.map(p => p.id)).toEqual([3, 2, 1]);
  });

  it("compares normalized name keys as UTF-8 bytes and breaks ties by ID", async () => {
    useData([
      { ...products[2], name: " alpha " },
      { ...products[1], name: "Alpha" },
      { ...products[0], name: "Zebra" },
      { ...products[0], id: 4, code: "AAAAAAAA04", name: "\u0104lpha" },
    ]);
    expect((await listProducts({ sort: "name" })).map(p => p.id)).toEqual([2, 3, 1, 4]);
  });

  it("retains legacy price sorting", async () => {
    expect((await listProducts({ sort: "priceDesc" })).map(p => p.id)).toEqual([3, 1, 2]);
  });

  it("filters available products and combines availability with category", async () => {
    expect((await listProducts({ available: true })).map(p => p.id)).toEqual([2, 3]);
    expect((await listProducts({ available: true, type: "cpu" })).map(p => p.id)).toEqual([3]);
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
