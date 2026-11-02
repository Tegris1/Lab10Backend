import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { createProductRepository } from "@/lib/products/prisma-product-repo";
import { getProductNameSortKey } from "@/lib/products/product-name";
import { seedCatalog } from "@/prisma/seed-catalog";
import type { Product } from "@/app/types/products";
import type { BaselineCriteria } from "../helpers/json-product-reference";

const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 1000 }) });
const repository = createProductRepository(client);
const source: Product[] = JSON.parse(await readFile(new URL("../../data/products.json", import.meta.url), "utf8"));
const edge: Product[] = JSON.parse(await readFile(new URL("../fixtures/catalog-adversarial.json", import.meta.url), "utf8"));
const baseline: Record<"catalog" | "adversarial", { criteria: BaselineCriteria; ids: number[] }[]> = JSON.parse(
  await readFile(new URL("../fixtures/catalog-baseline.json", import.meta.url), "utf8"),
);

beforeAll(async () => {
  const [identity] = await client.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  expect(identity.name).toMatch(/^shop_lab08_test_integration_[a-f0-9]{16}$/);
});
beforeEach(async () => {
  // The verified unique test database belongs exclusively to this run.
  await client.product.deleteMany();
  await seedCatalog(client, source);
});
afterAll(async () => { await client.$disconnect(); });

describe("PostgreSQL repository", () => {
  it.each(["catalog", "adversarial"] as const)("matches all frozen %s filter/sort results", async dataset => {
    if (dataset === "adversarial") {
      await client.product.deleteMany();
      await client.product.createMany({ data: edge.map(({ type, date, ...product }) => ({
        ...product, categoryCode: type, date: new Date(date), nameSortKey: getProductNameSortKey(product.name),
      })) });
    }
    for (const { criteria, ids } of baseline[dataset]) {
      expect((await repository.listProducts(criteria)).map(product => product.id), JSON.stringify(criteria)).toEqual(ids);
    }
    const data = dataset === "catalog" ? source : edge;
    for (const sort of ["nameAsc", "nameDesc"] as const) {
      const expected = [...data].sort((a, b) => (sort === "nameAsc" ? a.name.localeCompare(b.name, "pl-PL")
        : b.name.localeCompare(a.name, "pl-PL")) || a.id - b.id);
      expect((await repository.listProducts({ sort })).map(product => product.id)).toEqual(expected.map(product => product.id));
    }
  });

  it("maps complete domain records, preserves milliseconds and distinguishes zero stock from absence", async () => {
    expect(await repository.findProductById(1)).toEqual(source.find(product => product.id === 1));
    expect((await repository.findProductById(9))?.amount).toBe(0);
    expect(await repository.findProductById(2147483647)).toBeNull();
    expect((await repository.listProducts({ type: "cpu", stock: "unavailable", sort: "name" }))).toEqual([]);
    expect(await repository.listProducts({ available: true })).toEqual(source.filter(product => product.amount > 0));
    const prices = await repository.listProducts({ sort: "priceDesc" });
    expect(prices.map(product => product.id)).toEqual([...source].sort((a, b) => b.price - a.price || a.id - b.id).map(product => product.id));
  });

  it("rejects invalid IDs before issuing an ORM query", async () => {
    const find = vi.spyOn(client.product, "findUnique");
    for (const id of [0, -1, 1.5, 2147483648, NaN]) await expect(repository.findProductById(id)).rejects.toThrow(RangeError);
    expect(find).not.toHaveBeenCalled();
    find.mockRestore();
  });

  it("runs the local stock CLI and rejects negative stock and unknown IDs", async () => {
    const run = (...args: string[]) => spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/set-product-amount.ts", ...args], {
      env: process.env, encoding: "utf8", windowsHide: true, timeout: 10000,
    });
    expect(run("1", "0").status).toBe(0);
    expect((await repository.findProductById(1))?.amount).toBe(0);
    expect((await repository.listProducts({ stock: "available" })).some(product => product.id === 1)).toBe(false);
    expect(run("1", "-1").status).toBe(1);
    expect(run("2147483647", "1").status).toBe(1);
    expect((await repository.findProductById(1))?.amount).toBe(0);
  });

  it("rejects unavailable connections instead of returning null or an empty catalogue", async () => {
    const badUrl = new URL(process.env.DATABASE_URL!);
    badUrl.port = "1";
    const unavailable = new PrismaClient({ adapter: new PrismaPg({ connectionString: badUrl.toString(), connectionTimeoutMillis: 500 }) });
    try {
      const failing = createProductRepository(unavailable);
      await expect(failing.listProducts()).rejects.toThrow();
      await expect(failing.findProductById(1)).rejects.toThrow();
    } finally { await unavailable.$disconnect(); }
  });
});
