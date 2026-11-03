import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { demoUser } from "../lib/orders/demo-user.ts";
import { formatGrosze } from "../lib/orders/money.ts";
import { getProductNameSortKey } from "../lib/products/product-name.ts";
import { waitFor, withBrowser } from "./verify-browser.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const databaseName = new URL(process.env.DATABASE_URL ?? "").pathname.slice(1);
assert.match(databaseName, /^shop_lab08_test_browser_[a-f0-9]{16}$/, "Run through test:browser's isolated database launcher");
const database = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  await database.connect();
  assert.equal((await database.query("SELECT current_database() AS name")).rows[0].name, databaseName);
  const { rows: orders } = await database.query('SELECT "id", "number", "totalGrosze" FROM "Order" WHERE "userId" = $1 ORDER BY "orderedAt" DESC, "id"', [demoUser.id]);
  assert.equal(orders.length, 4);
  const historyPath = "/pages/order-history";
  const ready = "document.querySelectorAll('[data-order-id]').length === 4 && document.querySelector('[data-order-history]')?.getBoundingClientRect().height > 0";
  await withBrowser(root, async ({ navigate, evaluate, send }) => {
    const assertTotals = async () => {
      const rendered = await evaluate("Array.from(document.querySelectorAll('[data-order-total]'), node => node.textContent)");
      assert.deepEqual(rendered, orders.map(order => formatGrosze(order.totalGrosze)));
      assert.equal(await evaluate("document.querySelectorAll('[data-order-item]').length"), 6);
    };
    await navigate(historyPath, ready);
    assert.equal(await evaluate("document.title"), "Order history");
    assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('[data-order-id] h2'), node => node.textContent)"), orders.map(order => order.number));
    assert.ok(await evaluate("document.querySelector('[data-order-history]').textContent.includes('Demo account')"));
    await assertTotals();
    await mkdir(new URL("../.tools", import.meta.url), { recursive: true });
    const desktop = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(new URL("../.tools/order-history-desktop.png", import.meta.url), Buffer.from(desktop.data, "base64"));
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"));
    const mobile = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(new URL("../.tools/order-history-mobile.png", import.meta.url), Buffer.from(mobile.data, "base64"));
    console.log("PASS: four chronological demo orders, exact prices/totals, statuses and six items render on desktop and 390px mobile.");

    const changedName = "Changed current product";
    await database.query('UPDATE "Product" SET "name" = $1, "nameSortKey" = $2, "code" = $3, "price" = 1 WHERE "id" = 1', [changedName, getProductNameSortKey(changedName), "CHANGED001"]);
    const visitHistory = async () => {
      await navigate("/", "!!document.querySelector('#logo')");
      await navigate(historyPath, ready);
    };
    await visitHistory();
    const historicalItem = `[data-order-item="lab08-order-0001-line-1"]`;
    assert.ok((await evaluate(`document.querySelector('${historicalItem}').textContent`)).includes("Quantum DISK 1"));
    assert.ok((await evaluate(`document.querySelector('${historicalItem}').textContent`)).includes("R3SMC193Q8"));
    assert.ok(!(await evaluate("document.querySelector('[data-order-history]').textContent")).includes(changedName));
    await assertTotals();
    // Lab 09 protects products in active baskets. Remove the test basket references first.
    await database.query('DELETE FROM "CartItem" WHERE "productId" = 1');
    await database.query('DELETE FROM "Product" WHERE "id" = 1');
    await visitHistory();
    assert.ok((await evaluate(`document.querySelector('${historicalItem}').textContent`)).includes("No longer in catalogue"));
    assert.equal(await evaluate(`!!document.querySelector('${historicalItem} a')`), false);
    await assertTotals();
    await waitFor(() => evaluate(`Object.keys(document.querySelector('a[href="/product-list/2"]')).some(key => key.startsWith('__reactProps'))`), "hydrated history product link");
    await evaluate(`document.querySelector('main a[href="/product-list/2"]').click()`);
    await waitFor(() => evaluate("location.pathname === '/product-list/2' && !!document.querySelector('main dl')"), "current product from history");
    console.log("PASS: history retains purchased names/codes/prices after current changes and product deletion; remaining product links work.");
  });
} finally { await database.end(); }
