import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Product, ProductType } from "../app/types/products.js";

console.log("Starting product generator...");

const TYPES: ProductType[] = ["cpu", "gpu", "ram", "disk"];

const BRANDS = ["NovaTech", "Quantum", "Titan", "Vertex", "Apex", "CoreMax"];

function createRng(seed: number) {
  let state = seed >>> 0;

  return function random(): number {
    state += 0x6d2b79f5;

    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random: () => number, min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randomItem<T>(random: () => number, items: T[]): T {
  return items[randomInt(random, 0, items.length - 1)];
}

function generateCode(random: () => number, usedCodes: Set<string>): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  while (true) {
    let code = "";

    for (let i = 0; i < 10; i++) {
      code += chars[randomInt(random, 0, chars.length - 1)];
    }

    if (!usedCodes.has(code)) {
      usedCodes.add(code);
      return code;
    }
  }
}

function generateProducts(seed: number): Product[] {
  const random = createRng(seed);
  const usedCodes = new Set<string>();

  return Array.from({ length: 100 }, (_, index) => {
    const type = randomItem(random, TYPES);
    const brand = randomItem(random, BRANDS);

    const name = `${brand} ${type.toUpperCase()} ${index + 1}`;

    const description =
      `High quality ${type} component from ${brand}. ` +
      `Designed for reliable everyday use, good performance ` +
      `and long-term stability. Suitable for modern desktop systems.`;

    return {
      id: index + 1,
      code: generateCode(random, usedCodes),
      name,
      type,
      price: randomInt(random, 1000, 500000),
      amount: randomInt(random, 0, 100),
      description: description.slice(0, 255),
      date: new Date().toISOString(),
      image: `/img/${type}.jpg`,
    };
  });
}

const SEED = 12345;

console.log(`Seed: ${SEED}`);

const products = generateProducts(SEED);

console.log(`Generated ${products.length} products`);

const outputDirectory = "D:\\Studia\\backend\\computer-shop-2026jj\\data";

mkdirSync(outputDirectory, {
  recursive: true,
});

const outputPath = join(outputDirectory, "products.json");

console.log(`Writing products to: ${outputPath}`);

writeFileSync(outputPath, JSON.stringify(products, null, 2), "utf-8");

console.log(`Products written to: ${outputPath}`);
