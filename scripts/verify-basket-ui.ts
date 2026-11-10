import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { formatGrosze } from "../lib/orders/money";
import { createBrowserSession } from "./lib/browser-session";
import { waitFor, withBrowser } from "./verify-browser.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const expectedDatabase = new URL(process.env.DATABASE_URL ?? "").pathname.slice(1);
assert.match(expectedDatabase, /^shop_lab08_test_browser_[a-f0-9]{16}$/);
const database = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 1000 });
const productId = 900101;
const owner = "basket-ui-customer";
const other = "basket-ui-other";
const artifacts = new URL("../.tools/cart-e2e/", import.meta.url);
try {
  await database.connect();
  assert.equal((await database.query("SELECT current_database() AS name")).rows[0].name, expectedDatabase);
  const { rows: [reference] } = await database.query('SELECT "image" FROM "Product" WHERE "categoryCode" = $1 LIMIT 1', ["cpu"]);
  for (const [offset, amount] of [5, 0].entries()) {
    await database.query(`INSERT INTO "Product" ("id", "code", "name", "description", "image", "price", "amount", "date", "nameSortKey", "categoryCode")
      VALUES ($1, $2, $3, 'Isolated UI fixture', $4, 1234, $5, now(), $6, 'cpu')`,
    [productId + offset, `BASKETUI0${offset + 1}`, `Basket UI CPU ${offset + 1}`, reference.image, amount, `basket ui cpu ${offset + 1}`]);
  }
  for (const id of [owner, other]) {
    await database.query('INSERT INTO "User" ("id", "name", "email", "updatedAt") VALUES ($1, $2, $3, now())', [id, id, `${id}@example.test`]);
  }
  await database.query('INSERT INTO "Cart" ("id", "userId") VALUES ($1, $2)', ["basket-ui-other-cart", other]);
  await database.query('INSERT INTO "CartItem" ("id", "cartId", "productId", "quantity") VALUES ($1, $2, $3, 1)', ["basket-ui-other-item", "basket-ui-other-cart", productId]);
  const ownItems = async () => (await database.query(`SELECT i.* FROM "CartItem" i JOIN "Cart" c ON c."id" = i."cartId" WHERE c."userId" = $1`, [owner])).rows;
  const otherItem = async () => (await database.query('SELECT * FROM "CartItem" WHERE "id" = $1', ["basket-ui-other-item"])).rows[0];
  const otherBefore = await otherItem();
  const cartState = async () => ({
    carts: (await database.query('SELECT * FROM "Cart" ORDER BY "id"')).rows,
    items: (await database.query('SELECT * FROM "CartItem" ORDER BY "id"')).rows,
    stock: (await database.query('SELECT "id", "amount" FROM "Product" ORDER BY "id"')).rows,
  });

  await withBrowser(root, async ({ base, navigate, evaluate, send, requests }) => {
    await mkdir(artifacts, { recursive: true });
    try {
      const addForm = `[data-add-product="${productId}"]`;
      const addButton = `${addForm} [data-cart-add]`;
      const hydrated = (selector: string) => `!!document.querySelector('${selector}') && Object.keys(document.querySelector('${selector}')).some(key => key.startsWith('__reactProps'))`;
      const click = async (selector: string) => {
        await waitFor(() => evaluate(hydrated(selector)), `hydrated ${selector}`);
        await evaluate(`document.querySelector('${selector}').click()`);
      };
      const finished = async (selector: string) => {
        await waitFor(() => evaluate(`document.querySelector('${selector}')?.getAttribute('aria-busy') === 'false'`), `finished ${selector}`);
      };
      const setDraft = async (value: string) => {
        await evaluate(`(() => { const input = document.querySelector('[data-cart-quantity]');
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
          input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      };
      const waitQuantity = async (quantity: number) => {
        await waitFor(async () => (await ownItems())[0]?.quantity === quantity, `stored quantity ${quantity}`);
      };
      const waitTotal = async (grosze: number) => {
        await waitFor(() => evaluate(`document.querySelector('[data-cart-total]')?.textContent === ${JSON.stringify(formatGrosze(BigInt(grosze)))}`), `rendered total ${grosze}`);
      };
      const rpc = () => requests().filter(entry => entry.request.method === "POST" && Object.keys(entry.request.headers).some(key => key.toLowerCase() === "next-action")).at(-1)!.request;
      const header = (entry: ReturnType<typeof rpc>, name: string) => Object.entries(entry.headers).find(([key]) => key.toLowerCase() === name)?.[1];

      await navigate(`/product-list/${productId}`, `!!document.querySelector('${addButton}')`);
      await click(addButton);
      await finished(addForm);
      assert.equal((await ownItems()).length, 0, "Adding without a session must not create a basket item");
      await waitFor(() => evaluate(`!!document.querySelector('${addForm} a[href="/sign-in"]')`), "sign-in required feedback");
      const session = await createBrowserSession(base, owner);
      await send("Network.setCookie", session.cookie);
      await navigate(`/product-list/${productId}`, `!!document.querySelector('${addButton}')`);
      await send("Network.emulateNetworkConditions", { offline: false, latency: 250, downloadThroughput: -1, uploadThroughput: -1 });
      await click(addButton);
      await waitFor(() => evaluate(`document.querySelector('${addButton}').disabled && document.querySelector('${addForm}').getAttribute('aria-busy') === 'true'`), "pending add state");
      assert.ok(!String(await evaluate(`document.querySelector('${addForm}').textContent`)).includes("Added to basket."));
      await waitQuantity(1);
      await finished(addForm);
      await send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      const addRequest = rpc();
      await click(addButton);
      await waitQuantity(2);
      await finished(addForm);
      assert.equal((await ownItems()).length, 1);

      await navigate("/product-list?type=cpu", `!!document.querySelector('${addButton}')`);
      await click(addButton);
      await waitQuantity(3);
      await finished(addForm);
      await click(`${addForm} a[href="/basket"]`);
      await waitFor(() => evaluate("location.pathname === '/basket' && document.querySelectorAll('[data-cart-item]').length === 1"), "basket after add from catalogue");
      await waitTotal(3702);
      await waitFor(() => evaluate("document.querySelector('[data-cart-item] img')?.naturalWidth > 0"), "basket product image");

      for (const value of ["0", "-1", "1.5", "100", "6"]) {
        await setDraft(value);
        await click("[data-cart-update]");
        await finished("[data-cart-controls]");
        await waitFor(() => evaluate("document.querySelector('[data-cart-quantity]')?.getAttribute('aria-invalid') === 'true' && !!document.querySelector('[data-cart-controls] [role=alert]')"), `quantity error ${value}`);
        assert.equal((await ownItems())[0].quantity, 3);
        assert.ok(await evaluate("document.querySelector('[data-cart-quantity]').getAttribute('aria-describedby').split(' ').includes(document.querySelector('[data-cart-controls] [role=alert]').id)"));
      }
      await setDraft("4");
      await click("[data-cart-update]");
      await waitQuantity(4);
      await waitTotal(4936);
      const updateRequest = rpc();
      await waitFor(() => evaluate("document.querySelector('[data-cart-quantity]')?.value === '4'"), "refreshed quantity input");

      // Replay the actual Server Action HTTP requests with hostile inputs and session/origin headers.
      const replay = async (entry: ReturnType<typeof rpc>, input: object, cookie: string, origin = base) => {
        assert.ok(entry.postData, "Expected a captured Server Action body");
        const response = await fetch(`${base}/basket`, { method: "POST", headers: {
          "Next-Action": header(entry, "next-action")!,
          "Content-Type": header(entry, "content-type")!, Accept: "text/x-component", Origin: origin, Cookie: cookie,
        }, body: JSON.stringify([input]) });
        return { status: response.status, body: await response.text() };
      };
      const cookie = `${session.cookie.name}=${session.cookie.value}`;
      assert.ok((await replay(addRequest, { productId, userId: other, price: 0 }, cookie)).body.includes("INVALID_INPUT"));
      assert.ok((await replay(updateRequest, { itemId: "basket-ui-other-item", quantity: 2 }, cookie)).body.includes("ITEM_UNAVAILABLE"));
      const crossOrigin = await replay(addRequest, { productId }, cookie, "https://external.example.test");
      assert.ok(crossOrigin.status >= 400);
      assert.equal((await ownItems())[0].quantity, 4);
      assert.deepEqual(await otherItem(), otherBefore);

      const desktop = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }) as { data: string };
      await writeFile(new URL("desktop.png", artifacts), Buffer.from(desktop.data, "base64"));
      await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"));
      const mobile = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }) as { data: string };
      await writeFile(new URL("mobile.png", artifacts), Buffer.from(mobile.data, "base64"));

      await database.query('UPDATE "Product" SET "amount" = 2 WHERE "id" = $1', [productId]);
      await navigate("/basket", "!!document.querySelector('[data-cart-stock-warning]')");
      await setDraft("2");
      await click("[data-cart-update]");
      await waitQuantity(2);
      await waitTotal(2468);
      await database.query('UPDATE "Product" SET "amount" = 0 WHERE "id" = $1', [productId]);
      await navigate("/basket", "!!document.querySelector('[data-cart-stock-warning]') && document.querySelector('[data-cart-update]')?.disabled");
      await setDraft("0");
      await click("[data-cart-remove]");
      await waitFor(async () => (await ownItems()).length === 0, "stored removal");
      await waitFor(() => evaluate("document.querySelector('[data-basket]')?.textContent.includes('Your basket is empty.')"), "empty basket after removal");
      await waitTotal(0);
      const removeRequest = rpc();

      await navigate(`/product-list/${productId + 1}`, "document.querySelector('[data-cart-add]')?.disabled === true");
      await database.query('UPDATE "Product" SET "amount" = 2 WHERE "id" = $1', [productId]);
      await navigate(`/product-list/${productId}`, `!!document.querySelector('${addButton}')`);
      await click(addButton);
      await waitQuantity(1);
      await finished(addForm);
      const itemId = (await ownItems())[0].id as string;
      for (const invalidCookie of ["", "better-auth.session_token=forged-token"]) {
        for (const [operation, entry, input] of [
          ["add", addRequest, { productId }],
          ["update", updateRequest, { itemId, quantity: 2 }],
          ["remove", removeRequest, { itemId }],
        ] as const) {
          const before = await cartState();
          const response = await replay(entry, input, invalidCookie);
          assert.ok(response.body.includes("AUTH_REQUIRED"), `${operation} must refuse an absent or forged session`);
          assert.deepEqual(await cartState(), before, `${operation} without a valid session must not modify baskets or stock`);
        }
      }
      console.log("PASS: add, update and remove all reject missing and forged sessions without changing any basket or product stock.");
      await database.query('DELETE FROM "Session" WHERE "id" = $1', [session.sessionId]);
      await click(addButton);
      await finished(addForm);
      await waitFor(() => evaluate(`!!document.querySelector('${addForm} a[href="/sign-in"]')`), "revoked session mutation feedback");
      assert.equal((await ownItems())[0].quantity, 1);
      assert.deepEqual(await otherItem(), otherBefore);
      console.log("PASS: add from catalogue/details, pending feedback, quantity validation, live totals/images, stock correction and independent removal work on desktop and mobile.");
      console.log("PASS: actual Server Action HTTP requests reject missing/forged sessions, extra owner/price fields, another user's item and a foreign origin.");
    } catch (error) {
      try {
        const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }) as { data: string };
        await writeFile(new URL("failure.png", artifacts), Buffer.from(screenshot.data, "base64"));
      } catch { console.error("Could not capture the basket failure screenshot."); }
      throw error;
    }
  });
} finally { await database.end(); }
