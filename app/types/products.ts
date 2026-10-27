export type ProductType = "cpu" | "gpu" | "ram" | "disk";
export type CatalogSort = "name" | "newest";
export type ProductStock = "all" | "available" | "unavailable";
export type ProductSort = CatalogSort | "nameAsc" | "nameDesc" | "priceAsc" | "priceDesc";

export interface Product {
  id: number;
  code: string;
  name: string;
  type: ProductType;
  price: number;
  amount: number;
  description: string;
  date: string;
  image: string;
}
