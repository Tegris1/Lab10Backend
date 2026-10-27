import { describe, expect, it } from "vitest";
import { parseCatalogPath } from "@/lib/products/catalog-path";

describe("optional and required catalogue segments", () => {
  it("allows the optional root and requires at least one segment for the required variant", () => {
    expect(parseCatalogPath(undefined)).toEqual({});
    expect(parseCatalogPath([])).toEqual({});
    expect(parseCatalogPath(undefined, true)).toBeNull();
    expect(parseCatalogPath([], true)).toBeNull();
  });

  it("accepts category and product segments in both variants", () => {
    expect(parseCatalogPath(["cpu"])).toEqual({ type: "cpu" });
    expect(parseCatalogPath(["cpu"], true)).toEqual({ type: "cpu" });
    expect(parseCatalogPath(["gpu", "12"])).toEqual({ type: "gpu", id: 12 });
    expect(parseCatalogPath(["gpu", "12"], true)).toEqual({ type: "gpu", id: 12 });
  });

  it.each([
    ["unknown"], ["cpu", "1", "extra"], ["cpu", "01"],
  ])("rejects invalid path %j", (...slug) => {
    expect(parseCatalogPath(slug)).toBeNull();
    expect(parseCatalogPath(slug, true)).toBeNull();
  });

  it("does not mutate the segment array", () => {
    const slug = ["gpu", "12"];
    Object.freeze(slug);
    expect(parseCatalogPath(slug)).toEqual({ type: "gpu", id: 12 });
    expect(slug).toEqual(["gpu", "12"]);
  });
});
