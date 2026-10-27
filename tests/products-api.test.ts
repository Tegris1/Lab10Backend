import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/products/route";

const { listProducts } = vi.hoisted(() => ({ listProducts: vi.fn() }));
vi.mock("@/lib/products/product-repo", () => ({ listProducts }));

const request = (query = "") => new Request(`http://localhost/api/products${query}`);
beforeEach(() => {
  listProducts.mockResolvedValue([]);
});

describe("GET /api/products", () => {
  it("uses legacy defaults and returns JSON for an empty catalogue", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual([]);
    expect(listProducts).toHaveBeenCalledWith({ type: undefined, sort: "nameAsc" });
  });

  it("passes combined catalogue criteria and returns repository results", async () => {
    const products = [{ id: 1, name: "Test CPU", price: 100 }];
    listProducts.mockResolvedValue(products);
    const response = await GET(request("?type=cpu&stock=unavailable&sort=newest"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(products);
    expect(listProducts).toHaveBeenCalledWith({ type: "cpu", stock: "unavailable", sort: "newest" });
  });

  it("accepts explicit all filters and name sorting", async () => {
    expect((await GET(request("?type=all&stock=all&sort=name"))).status).toBe(200);
    expect(listProducts).toHaveBeenCalledWith({ type: undefined, stock: "all", sort: "name" });
  });

  it("preserves legacy availability and price sorting", async () => {
    expect((await GET(request("?type=gpu&available=true&sort=priceDesc"))).status).toBe(200);
    expect(listProducts).toHaveBeenCalledWith({ type: "gpu", available: true, sort: "priceDesc" });
  });

  it.each([
    "?type=invalid", "?sort=invalid", "?stock=", "?available=invalid",
    "?unknown=1", "?type=cpu&type=gpu", "?stock=all&available=true",
  ])("rejects invalid parameters %s before querying data", async query => {
    const response = await GET(request(query));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
    expect(listProducts).not.toHaveBeenCalled();
  });

  it("returns a safe JSON 500 and logs repository failures", async () => {
    const failure = new Error("Secret path: /private/products.json");
    listProducts.mockRejectedValue(failure);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET(request());
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({ error: expect.any(String) });
    expect(body).not.toContain(failure.message);
    expect(log).toHaveBeenCalledWith(expect.any(String), failure);
  });
});
