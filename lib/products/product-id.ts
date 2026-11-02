export function parseProductId(raw: string): number | null {
  const id = Number(raw);
  return /^[1-9][0-9]*$/.test(raw) && Number.isSafeInteger(id) && id >= 1 && id <= 2147483647
    ? id : null;
}

export function requireProductId(id: number): void {
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw new RangeError("Product ID must be an integer between 1 and 2147483647.");
}
