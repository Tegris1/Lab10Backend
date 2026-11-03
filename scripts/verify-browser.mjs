import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitFor(check, label, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(100);
  }
  throw new Error(`Timed out: ${label}`);
}

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function browserExecutable() {
  const candidates = [
    process.env.BROWSER_PATH,
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  const executable = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!executable) throw new Error("Set BROWSER_PATH to a Chromium, Edge or Chrome executable.");
  return executable;
}

async function connectDebugger(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  const requests = [];
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Network.requestWillBeSent") requests.push(message.params);
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  });
  return {
    close: () => socket.close(),
    requests: () => requests,
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Browser command timed out: ${method}`));
        }, 20000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

/**
 * Uses a disposable browser profile and a production server.
 * @param {string} workspace
 * @param {(browser: {
 *   base: string,
 *   navigate: (route: string, ready: string) => Promise<void>,
 *   evaluate: (expression: string) => Promise<unknown>,
 *   send: (method: string, params?: Record<string, unknown>) => Promise<unknown>,
 *   logs: () => string,
 *   requests: () => { request: { url: string, method: string, headers: Record<string, string>, postData?: string } }[],
 * }) => Promise<void>} run
 */
export async function withBrowser(workspace, run) {
  const executable = browserExecutable();
  const port = await unusedPort();
  const base = `http://127.0.0.1:${port}`;
  const profile = await mkdtemp(path.join(tmpdir(), "shop-browser-"));
  let logs = "";
  let browser;
  let debuggerClient;
  const server = spawn(process.execPath, [
    path.join(workspace, "node_modules/next/dist/bin/next"), "start", "--port", String(port),
  ], { cwd: workspace, env: { ...process.env, BETTER_AUTH_URL: base }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  for (const stream of [server.stdout, server.stderr]) stream.on("data", (data) => { logs += data; });
  try {
    await waitFor(async () => {
      if (server.exitCode !== null) throw new Error(`Production server exited: ${logs}`);
      try { return (await fetch(base)).ok; } catch { return false; }
    }, "production server");
    browser = spawn(executable, [
      "--headless=new", "--disable-gpu", "--disable-extensions", "--no-first-run", "--no-default-browser-check",
      ...(process.env.BROWSER_NO_SANDBOX === "1" ? ["--no-sandbox"] : []),
      "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
    ], { windowsHide: true, stdio: "ignore" });
    let debugPort;
    await waitFor(async () => {
      if (browser.exitCode !== null) throw new Error("Browser exited before debugging was ready.");
      try {
        debugPort = (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0];
        return true;
      } catch { return false; }
    }, "browser debugger");
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    debuggerClient = await connectDebugger(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
    const send = debuggerClient.send.bind(debuggerClient);
    await send("Page.enable");
    await send("Network.enable");
    await send("Network.setBlockedURLs", { urls: ["https://fonts.googleapis.com/*", "https://fonts.gstatic.com/*"] });
    const evaluate = async (expression) => {
      const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
      return response.result.value;
    };
    const navigate = async (route, ready) => {
      await send("Page.navigate", { url: base + route });
      await waitFor(() => evaluate(`location.href === ${JSON.stringify(base + route)} && document.readyState === 'complete' && !!document.body && (${ready})`), route);
    };
    await run({ base, send, evaluate, navigate, logs: () => logs, requests: debuggerClient.requests });
  } finally {
    debuggerClient?.close();
    const children = [browser, server].filter(Boolean);
    for (const child of children) child.kill();
    await Promise.all(children.map((child) => child.exitCode !== null ? undefined
      : new Promise((resolve) => { child.once("exit", resolve); setTimeout(resolve, 3000).unref(); })));
    const temporaryRoot = path.resolve(tmpdir()) + path.sep;
    if (!path.resolve(profile).startsWith(temporaryRoot)) throw new Error("Unexpected browser profile path.");
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

async function verifyNavigation() {
  const products = JSON.parse(await readFile(path.join(root, "data/products.json"), "utf8"));
  const byId = [...products].sort((a, b) => a.id - b.id);
  const manifest = JSON.parse(await readFile(path.join(root, ".next/prerender-manifest.json"), "utf8"));
  const prerendered = Object.keys(manifest.routes).filter((route) => /^\/product-list\/\d+$/.test(route)).sort();
  assert.deepEqual(prerendered, []);
  const onDemandProduct = byId[3];
  assert.ok(onDemandProduct, "Prerender checks need at least four products.");
  assert.ok(!prerendered.includes(`/product-list/${onDemandProduct.id}`));
  await withBrowser(root, async ({ base, send, evaluate, navigate, requests }) => {
    for (const product of [byId[0], onDemandProduct]) {
      const response = await fetch(`${base}/product-list/${product.id}`);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.ok(html.includes(product.code));
      assert.ok(html.includes(`<title>${product.name}</title>`));
    }
    console.log("PASS: no product is prerendered; product pages and metadata read the database at request time.");
    const catalogueReady = `!!document.querySelector('.product-list-controls select') &&
      Object.keys(document.querySelector('.product-list-controls select')).some(key => key.startsWith('__reactProps'))`;
    const current = () => evaluate(`({
      url: location.pathname + location.search,
      type: document.querySelector('.product-filters select')?.value,
      stock: document.querySelectorAll('.product-filters select')[1]?.value,
      sort: document.querySelector('input[name="sort"]:checked')?.value,
      ids: [...document.querySelectorAll('.product-items a')].map(link => Number(link.pathname.split('/').pop())),
      active: document.querySelector('#main-header a.active')?.getAttribute('href'),
      aria: document.querySelector('#main-header a.active')?.getAttribute('aria-current')
    })`);
    const assertCatalogue = async (route) => {
      await waitFor(async () => {
        const state = await current();
        const params = new URL(base + route).searchParams;
        return state.url === route && state.type === (params.get("type") ?? "all") &&
          state.stock === (params.get("stock") ?? "all") && state.sort === (params.get("sort") ?? "name");
      }, `catalogue state ${route}`);
      const state = await current();
      const expected = products.filter((product) => (state.type === "all" || state.type === product.type) &&
        (state.stock === "all" || (state.stock === "available" ? product.amount > 0 : product.amount === 0)));
      expected.sort(state.sort === "newest"
        ? (a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id - b.id
        : (a, b) => Buffer.compare(Buffer.from(a.name.normalize("NFC").trim().toLowerCase()),
          Buffer.from(b.name.normalize("NFC").trim().toLowerCase())) || a.id - b.id);
      assert.deepEqual(state.ids, expected.map((product) => product.id));
      assert.equal(state.active, "/product-list");
      assert.equal(state.aria, "page");
      return state;
    };
    await navigate("/product-list", catalogueReady);
    await assertCatalogue("/product-list");
    await evaluate(`document.querySelector('.product-filters select').value = 'gpu';
      document.querySelector('.product-filters select').dispatchEvent(new Event('change', { bubbles: true }))`);
    await assertCatalogue("/product-list?type=gpu");
    await evaluate(`document.querySelectorAll('.product-filters select')[1].value = 'available';
      document.querySelectorAll('.product-filters select')[1].dispatchEvent(new Event('change', { bubbles: true }))`);
    await assertCatalogue("/product-list?type=gpu&stock=available");
    await evaluate(`document.querySelector('input[value="newest"]').click()`);
    const filtered = "/product-list?type=gpu&stock=available&sort=newest";
    const state = await assertCatalogue(filtered);
    assert.ok(state.ids.length, "Dataset needs an available GPU for the product navigation check.");
    await evaluate("history.back()");
    await assertCatalogue("/product-list?type=gpu&stock=available");
    await evaluate("history.forward()");
    await assertCatalogue(filtered);
    await send("Page.reload");
    await waitFor(() => evaluate(catalogueReady), "hydration after refresh");
    await assertCatalogue(filtered);
    await navigate("/", `document.querySelector('#main-header a[aria-current="page"]')?.getAttribute('href') === '/'`);
    await navigate(filtered, catalogueReady);
    await assertCatalogue(filtered);
    await evaluate(`document.querySelector('.product-items a').click()`);
    await waitFor(() => evaluate(`location.pathname === '/product-list/${state.ids[0]}' &&
      document.querySelector('#main-header a[href="/product-list"]')?.getAttribute('aria-current') === 'location'`), "product Link navigation");
    assert.ok(requests().some(({ type, request }) => type === "Document" && request.url === base + "/product-list"));
    assert.ok(requests().some(({ type, request }) => type === "Fetch" && request.url.includes(`/product-list/${state.ids[0]}?`)
      && Object.keys(request.headers).some((key) => key.toLowerCase() === "rsc")));
    console.log("PASS: direct entry requests HTML; Link navigation requests React Server Component data.");
    await evaluate("history.back()");
    await assertCatalogue(filtered);
    await evaluate("history.forward()");
    await waitFor(() => evaluate(`location.pathname === '/product-list/${state.ids[0]}'`), "Forward to product");
    await evaluate(`document.querySelector('main a[href="/product-list"]').click()`);
    await assertCatalogue("/product-list");
    await navigate(filtered, catalogueReady);
    await evaluate(`document.querySelector('.product-filters button').click()`);
    await waitFor(() => evaluate(`location.search === ''`), "clear filters");
    await assertCatalogue("/product-list");
    console.log("PASS: filter changes, combined results, copied URL, refresh, Back/Forward, active navigation and clear filters.");
    const emptyCategory = ["cpu", "gpu", "ram", "disk"].find((type) => !products.some((p) => p.type === type && p.amount === 0));
    assert.ok(emptyCategory, "Dataset needs a category without out-of-stock products for the empty-result scenario.");
    const emptyRoute = `/product-list?type=${emptyCategory}&stock=unavailable`;
    await navigate(emptyRoute, catalogueReady);
    await assertCatalogue(emptyRoute);
    assert.ok(await evaluate(`document.querySelector('main').textContent.includes('No products match the selected filters.')`));
    await evaluate(`document.querySelector('.product-filters button').click()`);
    await assertCatalogue("/product-list");
    await evaluate(`document.querySelector('#main-header nav a').focus()`);
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    assert.equal(await evaluate(`document.activeElement.getAttribute('href')`), "/product-list");
    assert.equal(await evaluate(`getComputedStyle(document.activeElement).outlineStyle`), "solid");
    console.log("PASS: empty result can be cleared; keyboard navigation exposes a visible focus outline.");
    for (const product of [products.find((p) => p.amount > 0), products.find((p) => p.amount === 0)]) {
      assert.ok(product, "Dataset needs in-stock and out-of-stock products.");
      await navigate(`/product-list/${product.id}`, `document.querySelector('main')?.querySelector('h1')?.textContent === ${JSON.stringify(product.name)} && !!document.querySelector('main dl')`);
      assert.equal(await evaluate("document.title"), product.name);
      assert.ok((await evaluate("document.querySelector('main').textContent")).includes(product.code));
      await waitFor(() => evaluate("document.querySelector('main img').complete && document.querySelector('main img').naturalWidth > 0"), "product image");
    }
    for (const id of ["abc", "12abc", "0", "-1", "01", "2147483648", "9007199254740992", "2147483647"]) {
      await navigate(`/product-list/${id}`, `document.querySelector('main h1')?.textContent.includes('Product not found')`);
      assert.ok(await evaluate(`!!document.querySelector('main a[href="/product-list"]')`));
    }
    console.log("PASS: available/unavailable details, metadata, images and invalid/unknown ID views with catalogue links.");
    await navigate("/product-list?type=gpu&type=cpu&sort=newest", catalogueReady);
    assert.ok(await evaluate(`document.querySelector('[aria-label="URL settings notice"]').textContent.includes('invalid category')`));
    assert.equal((await current()).sort, "newest");
    assert.equal((await current()).type, "all");
    console.log("PASS: invalid query notice preserves valid settings.");
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyNavigation().catch((error) => { console.error(error); process.exitCode = 1; });
}
