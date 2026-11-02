// Keep this rule shared by catalogue sorting and every write of a product name.
export function getProductNameSortKey(name: string): string {
  return name.normalize("NFC").trim().toLowerCase();
}
