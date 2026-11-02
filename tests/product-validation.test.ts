import { describe, expect, it } from "vitest";
import { getProductNameSortKey } from "@/lib/products/product-name";
import { parseProducts, ProductValidationError } from "@/lib/products/product-validation";

const product = {
  id: 1, code: "VALIDCPU01", name: "CPU", type: "cpu", price: 0, amount: 1,
  description: "A processor", date: "2026-10-01T10:00:00.123Z", image: "/img/cpu.jpg",
};

describe("product input validation", () => {
  it("preserves source values without mutation and excludes unknown fields", () => {
    const input = Object.freeze([Object.freeze({ ...product, name: " E\u0301CLAIR ", nameSortKey: "untrusted" })]);
    const [parsed] = parseProducts(input, { requireCanonicalDates: true });
    expect(parsed).toEqual({ ...product, name: " E\u0301CLAIR " });
    expect(getProductNameSortKey(parsed.name)).toBe("éclair");
    expect(input[0].name).toBe(" E\u0301CLAIR ");
  });

  it("rejects invalid container/record shapes, including sparse arrays", () => {
    for (const input of [null, {}, "[]", [null], [[]], [1], Array(1)]) {
      expect(() => parseProducts(input)).toThrow(ProductValidationError);
    }
    expect(parseProducts([])).toEqual([]);
  });

  it.each(["id", "price", "amount"] as const)("enforces integer bounds for %s", field => {
    const minimum = field === "id" ? 1 : 0;
    for (const value of [minimum - 1, 2147483648, 1.5, "1", NaN, Infinity, null]) {
      expect(() => parseProducts([{ ...product, [field]: value }])).toThrow(ProductValidationError);
    }
    for (const value of [minimum, 2147483647]) {
      expect(parseProducts([{ ...product, [field]: value }])[0][field]).toBe(value);
    }
  });

  it("requires ten uppercase ASCII letters/digits and a known category", () => {
    for (const code of ["validcpu01", "ŻALIDCPU01", "SHORT", "VALIDCPU01\n"]) {
      expect(() => parseProducts([{ ...product, code }])).toThrow(ProductValidationError);
    }
    for (const type of ["CPU", "other", null]) {
      expect(() => parseProducts([{ ...product, type }])).toThrow(ProductValidationError);
    }
  });

  it.each(["id", "code"] as const)("rejects duplicate %s", field => {
    const second = { ...product, id: 2, code: "VALIDGPU02" };
    expect(() => parseProducts([product, { ...second, [field]: product[field] }])).toThrow(/duplicates/);
  });

  it.each(["name", "description"] as const)("requires nonblank text for %s", field => {
    for (const value of [" \t\n", 123, null, "a\0b"]) {
      expect(() => parseProducts([{ ...product, [field]: value }])).toThrow(ProductValidationError);
    }
  });

  it("requires real calendar dates and valid times", () => {
    for (const date of ["2026-02-30T10:00:00.123Z", "2026-10-01T24:00:00Z", "0000-01-01T00:00:00.000Z", "invalid", "2026-10-01"]) {
      expect(() => parseProducts([{ ...product, date }])).toThrow(ProductValidationError);
    }
  });

  it("requires canonical UTC milliseconds for seed input while retaining existing ISO-date reads", () => {
    expect(parseProducts([product], { requireCanonicalDates: true })[0].date).toBe(product.date);
    for (const date of ["2026-10-01T10:00:00Z", "2026-10-01T12:00:00.123+02:00"]) {
      expect(parseProducts([{ ...product, date }])[0].date).toBe(date);
      expect(() => parseProducts([{ ...product, date }], { requireCanonicalDates: true })).toThrow(ProductValidationError);
    }
  });

  it("rejects external images, path traversal, malformed escapes and control characters", () => {
    for (const image of ["https://example.com/image.jpg", "//example.com/image.jpg", "/", "/img/../cpu.jpg",
      "/img/%2e%2e/cpu.jpg", "/img\\cpu.jpg", "/img/cpu.jpg?x=1", "/img/cpu.jpg#image", "/img/%ZZ.jpg", "/img/%00.jpg"]) {
      expect(() => parseProducts([{ ...product, image }])).toThrow(ProductValidationError);
    }
    expect(parseProducts([{ ...product, image: "/img/component%20one.jpg" }])[0].image).toBe("/img/component%20one.jpg");
  });
});
