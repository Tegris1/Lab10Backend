import { readFile as readFixture } from "node:fs/promises";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Product } from "@/app/types/products";
import { listJsonReference, type BaselineCriteria } from "./helpers/json-product-reference";


type Baseline = {
  sourceSha256: string;
  catalog: { criteria: BaselineCriteria; ids: number[] }[];
  adversarial: { criteria: BaselineCriteria; ids: number[] }[];
};

const baseline: Baseline = JSON.parse(await readFixture(
  new URL("./fixtures/catalog-baseline.json", import.meta.url), "utf8",
));

describe("frozen Lab 07 catalogue baseline", () => {
  it.each([
    ["catalog", new URL("../data/products.json", import.meta.url)],
    ["adversarial", new URL("./fixtures/catalog-adversarial.json", import.meta.url)],
  ] as const)("preserves %s ordering for all category, stock and sort combinations", async (dataset, file) => {
    const source = await readFixture(file, "utf8");
    const products: Product[] = JSON.parse(source);
    if (dataset === "catalog") {
      expect(createHash("sha256").update(JSON.stringify(products)).digest("hex")).toBe(baseline.sourceSha256);
    }

    expect(baseline[dataset]).toHaveLength(30);
    for (const { criteria, ids } of baseline[dataset]) {
      const context = `${dataset}: ${JSON.stringify(criteria)}`;
      expect(listJsonReference(products, criteria).map(product => product.id), context).toEqual(ids);
    }
  });
});
