import { readFile } from "node:fs/promises";
import path from "node:path";

export type ProductType = "cpu" | "gpu" | "ram" | "disk";

export type Product = {
  id: number;
  code: string;
  name: string;
  type: ProductType;
  price: number;
  amount: number;
  description: string;
  image: string;
};

export class ProductRepository {
  private readonly filePath: string;

  constructor() {
    this.filePath = path.join(
      process.cwd(),
      "data",
      "products.json",
    );
  }

  async findAll(): Promise<Product[]> {
    const file = await readFile(this.filePath, "utf-8");

    return JSON.parse(file) as Product[];
  }

  async findById(id: number): Promise<Product | undefined> {
    const products = await this.findAll();

    return products.find((product) => product.id === id);
  }

  async findByType(type: ProductType): Promise<Product[]> {
    const products = await this.findAll();

    return products.filter((product) => product.type === type);
  }
}
