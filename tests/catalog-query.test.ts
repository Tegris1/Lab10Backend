import { describe, expect, it } from "vitest";
import { parseCatalogQuery, type CatalogSearchParams } from "@/lib/products/catalog-query";

const defaults = { type: undefined, stock: "all", sort: "name" };
const valid = { type: "gpu", stock: "available", sort: "newest" };

describe("catalogue URL interpretation", () => {
  it("parses a valid combination", () => {
    expect(parseCatalogQuery(valid)).toEqual({ criteria: valid, warnings: [] });
  });

  it("uses defaults without warnings for absent settings", () => {
    expect(parseCatalogQuery({})).toEqual({ criteria: defaults, warnings: [] });
  });

  it("accepts explicit defaults", () => {
    expect(parseCatalogQuery({ type: "all", stock: "all", sort: "name" }))
      .toEqual({ criteria: defaults, warnings: [] });
  });

  it.each(["type", "stock", "sort"] as const)("defaults only invalid %s and keeps other valid settings", (key) => {
    for (const value of ["unknown", "", [valid[key], valid[key]]]) {
      const input: CatalogSearchParams = { ...valid, [key]: value };
      const result = parseCatalogQuery(input);
      expect(result.criteria).toEqual({ ...valid, [key]: defaults[key] });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain(`(${key})`);
    }
  });

  it("ignores unknown parameter names regardless of their values", () => {
    expect(parseCatalogQuery({ ...valid, other: ["a", "b"], available: "true" }))
      .toEqual({ criteria: valid, warnings: [] });
  });

});
