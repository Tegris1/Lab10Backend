import type { Product, ProductType } from "../../app/types/products";

const maxInt = 2147483647;
const productTypes: readonly ProductType[] = ["cpu", "gpu", "ram", "disk"];
const isoTimestamp = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

export class ProductValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductValidationError";
  }
}

function requireInteger(value: unknown, minimum: number, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maxInt) {
    throw new ProductValidationError(`${field} must be an integer between ${minimum} and ${maxInt}.`);
  }
  return value;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.includes("\0")) {
    throw new ProductValidationError(`${field} must be nonblank text without null characters.`);
  }
  return value;
}

function requireDate(value: unknown, field: string, canonical: boolean): string {
  const date = requireText(value, field);
  const instant = new Date(date);
  const day = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  if (!isoTimestamp.test(date) || date.startsWith("0000-") || !Number.isFinite(instant.getTime()) ||
    !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date.slice(0, 10) ||
    (canonical && instant.toISOString() !== date)) {
    throw new ProductValidationError(`${field} must be a valid ${canonical ? "UTC timestamp with milliseconds" : "ISO timestamp"}.`);
  }
  return date;
}

function requireImage(value: unknown, field: string): string {
  const image = requireText(value, field);
  let decoded: string;
  try {
    decoded = decodeURIComponent(image);
  } catch {
    throw new ProductValidationError(`${field} must be a valid local image path.`);
  }
  const segments = decoded.split("/").slice(1);
  if (!image.startsWith("/") || !decoded.startsWith("/") || decoded.startsWith("//") ||
    /[\\?#\u0000-\u001f\u007f]/.test(decoded) ||
    segments.some(segment => segment === "" || segment === "." || segment === "..")) {
    throw new ProductValidationError(`${field} must be an absolute local path without traversal, query or fragment.`);
  }
  return image;
}

export function parseProducts(input: unknown, { requireCanonicalDates = false } = {}): Product[] {
  if (!Array.isArray(input)) {
    throw new ProductValidationError("The product catalogue must be an array.");
  }
  const ids = new Set<number>();
  const codes = new Set<string>();
  return Array.from(input, (value: unknown, index) => {
    const field = `Product ${index + 1}`;
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new ProductValidationError(`${field} must be an object.`);
    }
    const record = value as Record<string, unknown>;
    const id = requireInteger(record.id, 1, `${field}.id`);
    const code = requireText(record.code, `${field}.code`);
    if (code.length !== 10 || !/^[A-Z0-9]{10}$/.test(code)) {
      throw new ProductValidationError(`${field}.code must contain exactly ten uppercase ASCII letters or digits.`);
    }
    const type = productTypes.find(type => type === record.type);
    if (!type) throw new ProductValidationError(`${field}.type must be cpu, gpu, ram or disk.`);
    const product: Product = {
      id, code, type,
      name: requireText(record.name, `${field}.name`),
      description: requireText(record.description, `${field}.description`),
      price: requireInteger(record.price, 0, `${field}.price`),
      amount: requireInteger(record.amount, 0, `${field}.amount`),
      date: requireDate(record.date, `${field}.date`, requireCanonicalDates),
      image: requireImage(record.image, `${field}.image`),
    };
    if (ids.has(id) || codes.has(code)) {
      throw new ProductValidationError(`${field} duplicates an earlier product ID or code.`);
    }
    ids.add(id);
    codes.add(code);
    return product;
  });
}
