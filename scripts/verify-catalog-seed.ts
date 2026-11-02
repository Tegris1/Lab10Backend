import "dotenv/config";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { parseProducts, ProductValidationError } from "../lib/products/product-validation";
import { getProductNameSortKey } from "../lib/products/product-name";
import { catalogCategories, seedCatalog } from "../prisma/seed-catalog";
import { withIsolatedDatabase } from "./lib/isolated-database.mjs";

async function verifySeed() {
  const source = parseProducts(JSON.parse(await readFile(new URL("../data/products.json", import.meta.url), "utf8")), {
    requireCanonicalDates: true,
  });
  await withIsolatedDatabase("seed", async connectionString => {
    const client = new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }) });
    const snapshot = async () => ({
      categories: await client.category.findMany({ orderBy: { code: "asc" } }),
      products: await client.product.findMany({ orderBy: { id: "asc" } }),
    });
    try {
      await seedCatalog(client, source);
      const first = await snapshot();
      assert.equal(first.categories.length, 4);
      assert.equal(first.products.length, 100);
      assert.deepEqual(first.categories, [...catalogCategories].sort((a, b) => a.code.localeCompare(b.code)));
      assert.deepEqual(first.products.map(({ categoryCode, date, nameSortKey, ...product }) => {
        assert.equal(nameSortKey, getProductNameSortKey(product.name));
        return { ...product, type: categoryCode, date: date.toISOString() };
      }), [...source].sort((a, b) => a.id - b.id));
      await seedCatalog(client, source);
      assert.deepEqual(await snapshot(), first);
      console.log("PASS: two seeds produce four categories and 100 identical products, preserving every source field and sort key.");

      const unrelated = { ...first.products[0], id: 1000, code: "UNRELATED1", name: "Unrelated product", nameSortKey: "unrelated product" };
      await client.product.create({ data: unrelated });
      const beforeChanges = await snapshot();
      const original = first.products[0];
      await client.product.update({ where: { id: original.id }, data: {
        name: "Changed name", nameSortKey: getProductNameSortKey("Changed name"), amount: 0, price: 1,
        description: "Changed description", image: "/img/cpu.jpg", categoryCode: "gpu", date: new Date("2020-01-01T00:00:00.000Z"),
      } });
      await client.category.update({ where: { code: "cpu" }, data: { name: "Changed category" } });
      await seedCatalog(client, source);
      assert.deepEqual(await snapshot(), beforeChanges);
      console.log("PASS: seed restores all fixture-owned fields and category names while preserving unrelated products.");

      const invalidInputs = [
        source.slice(0, 99),
        source.map(product => ({ ...product, type: "cpu" })),
        source.map((product, index) => index === 99 ? { ...product, price: -1 } : product),
        source.map((product, index) => index === 99 ? { ...product, date: "2026-10-01T10:00:00Z" } : product),
        source.map((product, index) => index === 99 ? { ...product, image: "/img/seed-verification-missing-file.jpg" } : product),
      ];
      for (const input of invalidInputs) {
        await assert.rejects(seedCatalog(client, input), ProductValidationError);
      }
      assert.deepEqual(await snapshot(), beforeChanges);
      console.log("PASS: wrong size/categories, invalid final record/date and missing image leave the catalogue unchanged.");

      // Force failure late in the transaction, after category updates and product creates/updates.
      const last = first.products[first.products.length - 1];
      await client.product.delete({ where: { id: original.id } });
      await client.product.update({ where: { id: first.products[1].id }, data: { amount: 12345 } });
      await client.category.update({ where: { code: "cpu" }, data: { name: "Before rollback verification" } });
      await client.product.update({ where: { id: last.id }, data: { code: "CHANGED001" } });
      await client.product.create({ data: { ...last, id: 1001 } });
      const beforeConflict = await snapshot();
      await assert.rejects(seedCatalog(client, source), { code: "P2002" });
      assert.deepEqual(await snapshot(), beforeConflict);
      console.log("PASS: late unique-code conflict rolls back category updates and all earlier product creates/updates.");

      const failedSeed = spawnSync(process.execPath, [
        fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url)), "db", "seed",
      ], {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        env: { ...process.env, DATABASE_URL: connectionString },
        encoding: "utf8", windowsHide: true, timeout: 30000,
      });
      assert.equal(failedSeed.status, 1, "A failed seed must exit nonzero and close its pool without hanging");
      const output = failedSeed.stdout + failedSeed.stderr;
      assert.match(output, /Database seed failed/);
      assert.ok(!output.includes(decodeURIComponent(new URL(connectionString).password)));
      assert.deepEqual(await snapshot(), beforeConflict);
      console.log("PASS: failing CLI seed exits with code 1, closes its pool and omits credentials; catalogue remains unchanged.");
    } finally {
      await client.$disconnect();
    }
  });
}

verifySeed().catch(() => {
  console.error("Catalogue seed verification failed. Check local test settings, migrations, fixture validation and transactional import.");
  process.exitCode = 1;
});
