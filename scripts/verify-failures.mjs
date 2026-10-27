import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { waitFor, withBrowser } from "./verify-browser.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = await mkdtemp(path.join(root, ".verification-failures-"));
const originalPhase = process.env.SHOP_FAILURE_PHASE;

// Forced failures exist only in this disposable copy. The working app and data are never edited.
try {
  for (const entry of ["app", "lib", "public", "data", "package.json", "package-lock.json", "tsconfig.json", "postcss.config.mjs"]) {
    await cp(path.join(root, entry), path.join(fixture, entry), { recursive: true });
  }
  await symlink(path.join(root, "node_modules"), path.join(fixture, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  await writeFile(path.join(fixture, "next.config.ts"), `export default { turbopack: { root: ${JSON.stringify(path.resolve(root))} } };\n`);
  const routePath = path.join(fixture, "app/product-list/[id]/page.tsx");
  let route = await readFile(routePath, "utf8");
  function replaceOnce(before, after) {
    assert.equal(route.split(before).length, 2, `Failure fixture needs one occurrence of: ${before}`);
    route = route.replace(before, after);
  }
  replaceOnce("{ findProductById, listProducts }", "{ findProductById, listProducts, failureScope }");
  // Separate cache keys isolate the tested phase; otherwise a successful shared lookup can mask the forced failure.
  replaceOnce("cache(async (id: string) =>", 'cache(async (id: string, phase: "details" | "metadata") =>');
  replaceOnce("await findProductById(productId)", "await failureScope.run(phase, () => findProductById(productId))");
  replaceOnce("const product = await getProductDetails(id);", 'const product = await getProductDetails(id, "metadata");');
  replaceOnce("const productDetails = await getProductDetails(id);", 'const productDetails = await getProductDetails(id, "details");');
  await writeFile(routePath, route);
  const repositoryPath = path.join(fixture, "lib/products/product-repo.tsx");
  let repository = await readFile(repositoryPath, "utf8");
  const signature = "export function findProductById(id: number): Promise<Product | null> {";
  assert.ok(repository.includes(signature));
  repository = 'import { AsyncLocalStorage } from "node:async_hooks";\nexport const failureScope = new AsyncLocalStorage<string>();\n' +
    repository.replace(signature, signature + `
  if (process.env.SHOP_FAILURE_PHASE && failureScope.getStore() === process.env.SHOP_FAILURE_PHASE) {
    return Promise.reject(new Error("SHOP_TEST_PRIVATE_" + process.env.SHOP_FAILURE_PHASE));
  }`);
  await writeFile(repositoryPath, repository);
  // Build with forced failures disabled; select each failure at runtime in the fixture only.
  delete process.env.SHOP_FAILURE_PHASE;
  await new Promise((resolve, reject) => {
    const build = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "build"], {
      cwd: fixture, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    for (const stream of [build.stdout, build.stderr]) stream.on("data", (data) => { output += data; });
    build.once("error", reject);
    build.once("exit", (code) => code === 0 ? resolve() : reject(new Error(output)));
  });
  const products = JSON.parse(await readFile(path.join(fixture, "data/products.json"), "utf8"));
  const onDemandProduct = [...products].sort((a, b) => a.id - b.id)[3];
  assert.ok(onDemandProduct, "Failure checks need a product outside the three prerendered IDs.");
  const productRoute = `/product-list/${onDemandProduct.id}`;
  for (const phase of ["details", "metadata"]) {
    process.env.SHOP_FAILURE_PHASE = phase;
    await withBrowser(fixture, async ({ base, navigate, evaluate, logs }) => {
      const privateMarker = `SHOP_TEST_PRIVATE_${phase}`;
      try {
        await navigate(productRoute, `document.body.innerText.includes('Nie udało się wczytać produktów') ||
          document.body.innerText.includes('Application error') || document.body.innerText.includes('Internal Server Error')`);
      } catch (error) {
        console.error(`Failure phase: ${phase}; browser text:`, await evaluate("document.body?.innerText"));
        console.error(logs());
        throw error;
      }
      const text = await evaluate("document.body.innerText");
      assert.ok(!text.includes(privateMarker), "Private error must not reach the visible UI.");
      assert.ok(!text.includes("Product not found"), "An exception must not become a missing product.");
      assert.ok(!text.includes("Nie znaleziono strony"), "An exception must not become a generic 404.");
      await waitFor(() => logs().includes(privateMarker), `server log for ${phase}`);
      const response = await fetch(`${base}${productRoute}`);
      assert.ok(!(await response.text()).includes(privateMarker), "Private error must not reach HTML or serialized data.");
      console.log(`PASS: ${phase} repository failure logs its cause and shows a safe error view, without 404 or private details.`);
    });
  }
  delete process.env.SHOP_FAILURE_PHASE;
  await withBrowser(fixture, async ({ navigate, evaluate }) => {
    await navigate(productRoute, "!!document.querySelector('main dl')");
    assert.ok(!(await evaluate("document.body.innerText")).includes("Application error"));
    console.log("PASS: product details recover with forced failures disabled.");
  });
} finally {
  if (originalPhase === undefined) delete process.env.SHOP_FAILURE_PHASE;
  else process.env.SHOP_FAILURE_PHASE = originalPhase;
  const fixturePrefix = path.join(path.resolve(root), ".verification-failures-");
  if (!path.resolve(fixture).startsWith(fixturePrefix)) throw new Error("Unexpected failure fixture path.");
  // Remove the dependency junction before recursively removing only the verified temporary fixture.
  await unlink(path.join(fixture, "node_modules")).catch((error) => { if (error.code !== "ENOENT") throw error; });
  await rm(fixture, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
