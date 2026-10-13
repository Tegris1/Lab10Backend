import { readFile } from "fs";
import type { Product, ProductSort, ProductType } from "../../app/types/products";
import "server-only";

export type { ProductSort } from "../../app/types/products";

type ProductQuery = {
  sort?: ProductSort;
  available?: boolean;
  all?: boolean;
  type?: ProductType;
};
const sortFunctions: Record<ProductSort, (a: Product, b: Product) => number> = {
  nameAsc: (a, b) => a.name.localeCompare(b.name),
  nameDesc: (a, b) => b.name.localeCompare(a.name),
  priceAsc: (a, b) => a.price - b.price,
  priceDesc: (a, b) => b.price - a.price,
};

export function listProducts(options?: ProductQuery): Promise<Product[]> {
  return readProducts().then((products) => {
    const filteredProducts = filterProducts(options || {}, products);
    if (options?.sort) {
      filteredProducts.sort(sortFunctions[options.sort]);
    }
    return filteredProducts;
  });
}

function filterProducts(options: ProductQuery, products: Product[]): Product[] {
  return products.filter((product) => {
    return (
      (!options.available || product.amount > 0) &&
      (options.type === undefined || options.type === product.type)
    );
  });
}

function readProducts(): Promise<Product[]> {
  return new Promise((resolve, reject) => {
    readFile("data/products.json", "utf-8", (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      try {
        const products = JSON.parse(data) as Product[];
        validate(products);
        resolve(products);
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
}

export function findProductById(id: number): Promise<Product | null> {
  return readProducts().then((products) => {
    return products.find((product) => product.id === id) || null;
  });
}

function validate(productList: Product[]): void {
  const ids = new Set<number>();
  const codes = new Set<string>();
  for (const product of productList) {
    if (
      !Number.isInteger(product.id) ||
      product.id <= 0 ||
      !product.code ||
      !product.name ||
      !product.type ||
      !Number.isInteger(product.price) ||
      product.price < 0 ||
      !Number.isInteger(product.amount) ||
      product.amount < 0 ||
      !product.description ||
      !product.date ||
      !product.image
    ) {
      throw new Error(`Invalid product data: ${JSON.stringify(product)}`);
    }
    if (ids.has(product.id) || codes.has(product.code)) {
      throw new Error("Duplicate product id or code");
    }
    ids.add(product.id);
    codes.add(product.code);
    if (
      product.type !== "cpu" &&
      product.type !== "gpu" &&
      product.type !== "ram" &&
      product.type !== "disk"
    ) {
      throw new Error(`Invalid product type: ${product.type}`);
    }
  }
}
