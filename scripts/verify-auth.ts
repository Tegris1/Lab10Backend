import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { formatGrosze } from "../lib/orders/money";
import { createBrowserSession } from "./lib/browser-session";
import { waitFor, withBrowser } from "./verify-browser.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const expectedDatabase = new URL(process.env.DATABASE_URL ?? "").pathname.slice(1);
assert.match(expectedDatabase, /^shop_lab08_test_browser_[a-f0-9]{16}$/);
const database = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 1000 });
try {
  await database.connect();
  assert.equal((await database.query("SELECT current_database() AS name")).rows[0].name, expectedDatabase);
  for (const suffix of ["a", "b"]) {
    await database.query('INSERT INTO "User" ("id", "name", "email", "updatedAt") VALUES ($1, $2, $3, now())',
      [`auth-browser-${suffix}`, `Browser Customer ${suffix.toUpperCase()}`, `browser-${suffix}@example.test`]);
  }
  await withBrowser(root, async ({ base, navigate, evaluate, send, requests }) => {
    const required = "!!document.querySelector('[data-auth-required]')";
    await navigate("/basket", required);
    assert.equal(await evaluate("document.querySelectorAll('[data-cart-item]').length"), 0);
    await navigate("/pages/basket", required);
    await navigate("/sign-in?error=untrusted-provider-details", "!!document.querySelector('[data-sign-in]')");
    assert.ok(!String(await evaluate("document.querySelector('main').textContent")).includes("untrusted-provider-details"));

    // Inspect the start of OAuth while blocking all GitHub navigation; no personal account is used.
    await send("Network.setBlockedURLs", { urls: ["https://fonts.googleapis.com/*", "https://fonts.gstatic.com/*", "https://github.com/*"] });
    await waitFor(() => evaluate("Object.keys(document.querySelector('main [data-auth-sign-in]')).some(key => key.startsWith('__reactProps'))"), "hydrated sign-in button");
    await evaluate("document.querySelector('main [data-auth-sign-in]').click()");
    await waitFor(() => requests().some(entry => entry.request.url.startsWith("https://github.com/login/oauth/authorize")), "GitHub authorization request");
    const authorization = new URL(requests().find(entry => entry.request.url.startsWith("https://github.com/login/oauth/authorize"))!.request.url);
    assert.equal(authorization.searchParams.get("redirect_uri"), `${base}/api/auth/callback/github`);
    assert.ok(authorization.searchParams.get("state"));
    assert.ok(authorization.searchParams.get("scope")?.includes("user:email"));

    const sessionA = await createBrowserSession(base, "auth-browser-a");
    await send("Network.setCookie", sessionA.cookie);
    await navigate("/basket", "document.querySelector('[data-auth-user]')?.textContent.includes('Browser Customer A') && !!document.querySelector('[data-cart-total]')");
    assert.equal(await evaluate("document.querySelector('[data-cart-total]').textContent"), formatGrosze("0"));
    assert.equal(await evaluate("document.querySelectorAll('[data-cart-item]').length"), 0);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM "Cart" WHERE "userId" = $1', ["auth-browser-a"])).rows[0].count, 0);
    await database.query('INSERT INTO "Cart" ("id", "userId") VALUES ($1, $2)', ["auth-browser-cart", "auth-browser-a"]);
    await database.query('INSERT INTO "CartItem" ("id", "cartId", "productId", "quantity") VALUES ($1, $2, 4, 1)', ["auth-browser-item", "auth-browser-cart"]);
    await navigate("/basket", "document.querySelectorAll('[data-cart-item]').length === 1");
    const html = await (await fetch(`${base}/basket`, { headers: { cookie: `${sessionA.cookie.name}=${sessionA.cookie.value}` } })).text();
    assert.ok(!html.includes(sessionA.cookie.value));
    assert.ok(!html.includes(process.env.GITHUB_CLIENT_SECRET!));
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"));

    await waitFor(() => evaluate("Object.keys(document.querySelector('[data-auth-sign-out]')).some(key => key.startsWith('__reactProps'))"), "hydrated sign-out button");
    await evaluate("document.querySelector('[data-auth-sign-out]').click()");
    await waitFor(() => evaluate("location.pathname === '/' && !!document.querySelector('[data-auth-sign-in]') && !document.querySelector('[data-auth-user]')"), "server state after sign-out");
    assert.equal((await database.query('SELECT count(*)::int AS count FROM "Session" WHERE "id" = $1', [sessionA.sessionId])).rows[0].count, 0);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM "CartItem" WHERE "id" = $1', ["auth-browser-item"])).rows[0].count, 1);
    await navigate("/basket", required);
    await send("Network.setCookie", sessionA.cookie);
    await navigate("/basket", required);
    const replacement = await createBrowserSession(base, "auth-browser-a");
    await send("Network.setCookie", replacement.cookie);
    await navigate("/basket", "document.querySelectorAll('[data-cart-item]').length === 1");

    const sessionB = await createBrowserSession(base, "auth-browser-b");
    await send("Network.setCookie", sessionB.cookie);
    await navigate("/basket", "document.querySelector('[data-auth-user]')?.textContent.includes('Browser Customer B') && !!document.querySelector('[data-cart-total]')");
    assert.equal(await evaluate("document.querySelectorAll('[data-cart-item]').length"), 0);
    await database.query('UPDATE "Session" SET "expiresAt" = $1 WHERE "id" = $2', [new Date("2000-01-01T00:00:00.000Z"), sessionB.sessionId]);
    await navigate("/basket", required);
    console.log("PASS: OAuth starts with state/email scope; server-rendered identity, private baskets, sign-out, revoked/expired sessions and re-login agree on desktop and mobile.");
  });
} finally { await database.end(); }
