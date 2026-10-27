export function parseProductId(raw: string): number | null {
  const id = Number(raw);
  return /^[1-9][0-9]*$/.test(raw) && Number.isSafeInteger(id) && id >= 1 && id <= 2147483647
    ? id : null;
}
