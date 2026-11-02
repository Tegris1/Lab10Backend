import "dotenv/config";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { withIsolatedDatabase } from "./lib/isolated-database.mjs";
import { seedDatabase } from "./lib/run-local.mjs";
import { withBrowser, waitFor } from "./verify-browser.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const compose = (...args) => execFileSync("docker", ["compose", ...args], { cwd: root, windowsHide: true, stdio: "pipe", timeout: 90000 });
await withIsolatedDatabase("failure", async connectionString => {
  seedDatabase(connectionString);
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = connectionString;
  try {
    await withBrowser(root, async ({ base, navigate, evaluate, logs }) => {
      await navigate("/product-list/1", "!!document.querySelector('main dl')");
      try {
        compose("stop", "postgres");
        for (const route of ["/product-list", "/product-list/1", "/pages/order-history"]) {
          await navigate(route, `document.querySelector('main h1')?.textContent.startsWith('Nie uda') || document.body.innerText.includes('Could not load order history') || document.body.innerText.includes('Application error') || document.body.innerText.includes('Internal Server Error')`);
          const text = await evaluate("document.body.innerText");
          assert.ok(!text.includes("Product not found") && !text.includes("No products match"));
          const html = await (await fetch(base + route)).text();
          assert.ok(!html.includes(decodeURIComponent(new URL(connectionString).password)));
          assert.ok(!html.includes("ECONNREFUSED"));
        }
        const api = await fetch(base + "/api/products");
        assert.equal(api.status, 500);
        assert.ok((await api.json()).error);
        await waitFor(() => /ECONNREFUSED|PrismaClient|database/i.test(logs()), "database failure logged on the server");
        console.log("PASS: a stopped database produces safe catalogue/details/metadata/order-history failures and API 500, never an empty result or missing product.");
      } finally { compose("start", "--wait", "--wait-timeout", "60", "postgres"); }
      await navigate("/product-list", "!!document.querySelector('.product-items')");
      await navigate("/product-list/1", "!!document.querySelector('main dl')");
      await navigate("/pages/order-history", "document.querySelectorAll('[data-order-id]').length === 4");
      assert.equal((await fetch(base + "/api/products")).status, 200);
      console.log("PASS: production pages and API recover after database readiness returns.");
    });
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});
