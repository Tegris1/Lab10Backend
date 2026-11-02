import "dotenv/config";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { getProductNameSortKey } from "../lib/products/product-name.ts";
import { withIsolatedDatabase } from "./lib/isolated-database.mjs";
import { runNode, seedDatabase } from "./lib/run-local.mjs";
import { waitFor, withBrowser } from "./verify-browser.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const compose = (...args) => execFileSync("docker", ["compose", ...args], { cwd: root, windowsHide: true, stdio: "pipe", timeout: 90000 });

await withIsolatedDatabase("persistence", async connectionString => {
  seedDatabase(connectionString); // Setup only. Never seed after changing stock.
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = connectionString;
  const verifyStock = async ({ navigate, evaluate }) => {
    await navigate("/product-list", `!!document.querySelector('.product-items a[href="/product-list/1"]')`);
    const cardStock = await evaluate(`document.querySelector('.product-items a[href="/product-list/1"]').closest('article').querySelector('.product-quantity').textContent`);
    assert.equal(cardStock.trim(), "0 available");
    await navigate("/product-list?stock=available", "!!document.querySelector('.product-items')");
    assert.equal(await evaluate(`!!document.querySelector('.product-items a[href="/product-list/1"]')`), false);
    await navigate("/product-list?stock=unavailable", "!!document.querySelector('.product-items')");
    await waitFor(() => evaluate(`Object.keys(document.querySelector('.product-items a')).some(key => key.startsWith('__reactProps'))`), "hydrated product Link");
    await evaluate(`document.querySelector('.product-items a[href="/product-list/1"]').click()`);
    await waitFor(() => evaluate(`location.pathname === '/product-list/1' && !!document.querySelector('main dl')`), "product Link");
    assert.ok((await evaluate("document.querySelector('main dl').textContent")).includes("Out of stock — 0 units"));
    await navigate("/product-list/1", "!!document.querySelector('main dl')");
    assert.ok((await evaluate("document.querySelector('main dl').textContent")).includes("Out of stock — 0 units"));
    assert.match(await evaluate("document.querySelector('time').textContent"), /\.\d{3}Z$/);
    await navigate("/pages/order-history", "document.querySelectorAll('[data-order-id]').length === 4 && document.querySelector('[data-order-history]')?.getBoundingClientRect().height > 0");
    const historyItem = await evaluate(`document.querySelector('[data-order-item="lab08-order-0001-line-1"]').textContent`);
    assert.ok(historyItem.includes("Quantum DISK 1") && historyItem.includes("R3SMC193Q8"));
  };
  try {
    await withBrowser(root, async browser => {
      const original = (await (await fetch(browser.base + "/api/products")).json()).find(product => product.id === 1);
      assert.ok(original.amount > 0);
      await browser.navigate("/product-list/1", "!!document.querySelector('main dl')");
      await browser.evaluate(`document.querySelector('main a[href="/product-list"]').click()`);
      await waitFor(() => browser.evaluate(`location.pathname === '/product-list' && !!document.querySelector('.product-items a[href="/product-list/1"]')`), "return Link before stock update");
      runNode(["node_modules/tsx/dist/cli.mjs", "scripts/set-product-amount.ts", "1", "0"]);
      const changedName = `${original.name} — persisted`;
      const database = new pg.Client({ connectionString });
      try {
        await database.connect();
        await database.query('UPDATE "Product" SET "name" = $1, "nameSortKey" = $2 WHERE "id" = 1', [changedName, getProductNameSortKey(changedName)]);
      } finally { await database.end(); }
      await browser.evaluate(`document.querySelector('.product-items a[href="/product-list/1"]').click()`);
      await waitFor(() => browser.evaluate(`document.title === ${JSON.stringify(changedName)} && document.querySelector('main dl')?.textContent.includes('Out of stock — 0 units')`), "fresh previously visited product and metadata via Link");
      const html = await (await fetch(browser.base + "/product-list/1")).text();
      assert.ok(html.includes(`<title>${changedName}</title>`));
      await verifyStock(browser);
      console.log(`PASS: stock ${original.amount} -> 0 appears on list, availability filters and details via direct entry and Link; previously visited details and metadata show the changed name.`);
    }); // Production application process stops here.
    try { compose("stop", "postgres"); }
    finally { compose("start", "--wait", "--wait-timeout", "60", "postgres"); }
    await withBrowser(root, verifyStock); // A new application process, same database volume.
    console.log("PASS: stock remains 0 after application and container restart, without reseeding or rebuilding; direct and Link reads agree.");
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});
