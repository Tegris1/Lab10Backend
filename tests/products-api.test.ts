import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/products/route";

const { listProducts } = vi.hoisted(() => ({ listProducts: vi.fn() }));
vi.mock("@/lib/products/product-repo", () => ({ listProducts }));

const request = (query = "") => new Request(`http://localhost/api/products${query}`);
beforeEach(() => {
  listProducts.mockResolvedValue([]);
});

describe("GET /api/products", () => {
  it("uses default sorting and returns JSON [] when the catalog is empty", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual([]);
    expect(listProducts).toHaveBeenCalledWith({ type: undefined, sort: "nameAsc" });
  });

  it.each(["cpu", "gpu", "ram", "disk"])("passes category %s and sorting to the shared repository", async type => {
    const response = await GET(request(`?type=${type}&sort=priceDesc`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(listProducts).toHaveBeenCalledWith({ type, sort: "priceDesc" });
  });

  it.each(["nameAsc", "nameDesc", "priceAsc", "priceDesc"])("accepts sort %s", async sort => {
    expect((await GET(request(`?sort=${sort}`))).status).toBe(200);
    expect(listProducts).toHaveBeenCalledWith({ type: undefined, sort });
  });

  it("returns repository results", async () => {
    const products = [{ id: 1, name: "Test CPU", price: 100 }];
    listProducts.mockResolvedValue(products);
    expect(await (await GET(request())).json()).toEqual(products);
  });

  it.each([
    "?type=invalid", "?type=", "?type=CPU", "?sort=invalid", "?sort=",
    "?sort=NAMEASC", "?type=cpu&type=gpu", "?sort=nameAsc&sort=priceAsc", "?unknown=1",
  ])("returns JSON 400 for %s before reading data", async query => {
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
