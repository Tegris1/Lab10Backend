import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { demoUser } from "../lib/orders/demo-user.ts";
import { formatGrosze } from "../lib/orders/money.ts";
import { getProductNameSortKey } from "../lib/products/product-name.ts";
import { waitFor, withBrowser } from "./verify-browser.mjs";
import { createBrowserSession } from "./lib/browser-session.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const databaseName = new URL(process.env.DATABASE_URL ?? "").pathname.slice(1);
assert.match(databaseName, /^shop_lab08_test_browser_[a-f0-9]{16}$/, "Run through test:browser's isolated database launcher");
const database = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  await database.connect();
  assert.equal((await database.query("SELECT current_database() AS name")).rows[0].name, databaseName);
  const { rows: [cart] } = await database.query('SELECT * FROM "Cart" WHERE "userId" = $1', [demoUser.id]);
  assert.ok(cart);
  const { rows: items } = await database.query('SELECT * FROM "CartItem" WHERE "cartId" = $1 ORDER BY "productId"', [cart.id]);
  assert.equal(items.length, 3);
  const { rows: [product] } = await database.query('SELECT * FROM "Product" WHERE "id" = $1', [items[0].productId]);
  let cartDeleted = false;
  try {
    await withBrowser(root, async ({ base, navigate, evaluate, send }) => {
      const session = await createBrowserSession(base, demoUser.id);
      await send("Network.setCookie", session.cookie);
      const ready = "!!document.querySelector('[data-basket]')";
      await navigate("/basket", ready);
      assert.equal(await evaluate("document.title"), "Basket");
      assert.equal(await evaluate("document.querySelectorAll('[data-cart-item]').length"), items.length);
      assert.ok(await evaluate(`document.querySelector('[data-basket]').textContent.includes(${JSON.stringify(demoUser.name)})`));
      const { rows: [{ total }] } = await database.query(`
        SELECT SUM(i."quantity"::bigint * p."price")::text AS total
        FROM "CartItem" i JOIN "Product" p ON p."id" = i."productId" WHERE i."cartId" = $1
      `, [cart.id]);
      assert.equal(await evaluate("document.querySelector('[data-cart-total]').textContent"), formatGrosze(total));
      await mkdir(new URL("../.tools", import.meta.url), { recursive: true });
      const desktop = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
      await writeFile(new URL("../.tools/cart-desktop.png", import.meta.url), Buffer.from(desktop.data, "base64"));
      await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"));
      const mobile = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
      await writeFile(new URL("../.tools/cart-mobile.png", import.meta.url), Buffer.from(mobile.data, "base64"));

      const itemSelector = `[data-cart-item="${items[0].id}"]`;
      await waitFor(() => evaluate(`Object.keys(document.querySelector('${itemSelector} a')).some(key => key.startsWith('__reactProps'))`), "hydrated basket product link");
      await evaluate(`document.querySelector('${itemSelector} a').click()`);
      await waitFor(() => evaluate(`location.pathname === '/product-list/${product.id}' && !!document.querySelector('main dl')`), "product from basket");

      const changedName = "Updated basket product";
      await database.query('UPDATE "Product" SET "name" = $1, "nameSortKey" = $2, "price" = 1, "amount" = 0 WHERE "id" = $3', [changedName, getProductNameSortKey(changedName), product.id]);
      await waitFor(() => evaluate("Object.keys(document.querySelector('#main-header a[href=\"/basket\"]')).some(key => key.startsWith('__reactProps'))"), "hydrated basket navigation");
      await evaluate("document.querySelector('#main-header a[href=\"/basket\"]').click()");
      await waitFor(() => evaluate(`location.pathname === '/basket' && document.querySelector('${itemSelector}')?.textContent.includes('${changedName}')`), "current basket through Link");
      assert.ok((await evaluate(`document.querySelector('${itemSelector}').textContent`)).includes("Out of stock"));
      assert.ok((await evaluate(`document.querySelector('${itemSelector}').textContent`)).includes(formatGrosze("1")));
      console.log("PASS: saved basket, exact totals, live prices/availability and product links render on desktop and 390px mobile.");

      await database.query('DELETE FROM "Cart" WHERE "id" = $1', [cart.id]);
      cartDeleted = true;
      await navigate("/basket", "document.querySelector('[data-basket]')?.textContent.includes('Your basket is empty.')");
      assert.equal(await evaluate("document.querySelectorAll('[data-cart-item]').length"), 0);
      console.log("PASS: deleting the saved cart renders the empty basket view.");
    });
  } finally {
    await database.query('UPDATE "Product" SET "name" = $1, "nameSortKey" = $2, "price" = $3, "amount" = $4 WHERE "id" = $5', [product.name, product.nameSortKey, product.price, product.amount, product.id]);
    if (cartDeleted) {
      await database.query('INSERT INTO "Cart" ("id", "userId") VALUES ($1, $2)', [cart.id, cart.userId]);
      for (const item of items) {
        await database.query('INSERT INTO "CartItem" ("id", "cartId", "productId", "quantity") VALUES ($1, $2, $3, $4)', [item.id, item.cartId, item.productId, item.quantity]);
      }
    }
  }
} finally { await database.end(); }
