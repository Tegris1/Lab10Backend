import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { waitFor, withBrowser } from "./verify-browser.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const products = JSON.parse(await readFile(new URL("../data/products.json", import.meta.url), "utf8"));
const sample = products.find(product => product.id === 1);
assert.ok(sample);
const productPath = `/product-list/${sample.id}`;
const imagePath = `${productPath}/image`;
const addedPath = ''
await withBrowser(root, async ({ send, evaluate, navigate }) => {
  const heading = (text) => `document.querySelector('main h1')?.textContent === ${JSON.stringify(text)}`;
  for (const base of ["/catalog", "/catalog/required"]) {
    for (const type of ["cpu", "gpu", "ram", "disk"]) {
      await navigate(`${base}/${type}`, heading(`${type.toUpperCase()} catalogue`));
      const ids = await evaluate(`Array.from(document.querySelectorAll('[aria-label="Catalogue products"] a'), a => Number(a.pathname.split('/').pop()))`);
      assert.deepEqual([...ids].sort((a, b) => a - b), products.filter(p => p.type === type).map(p => p.id).sort((a, b) => a - b));
    }
    await navigate(`${base}/${sample.type}/${sample.id}`, heading(sample.name));
    await send("Page.reload");
    await waitFor(() => evaluate(heading(sample.name)), "catch-all product refresh");
    for (const suffix of ["invalid", "cpu/01", "cpu/2147483648", `${sample.type}/2147483647`, `${sample.type}/${sample.id}/extra`, `cpu/${sample.id}`]) {
      await navigate(`${base}/${suffix}`, heading("Catalogue page not found"));
    }
  }
  await navigate("/catalog", heading("Component catalogue"));
  await navigate("/catalog/required", heading("Catalogue page not found"));
  await navigate("/catalog/cpu?type=gpu", heading("CPU catalogue"));
  console.log("PASS: optional/required catch-all roots, all categories, product/category matching, invalid IDs, segment count and refresh.");

  const modalOpen = () => evaluate(`!!document.querySelector('dialog[open]') && location.pathname === '${imagePath}'`);
  const modalClosed = () => evaluate(`!document.querySelector('dialog') && location.pathname === '${productPath}'`);
  const openImage = async () => {
    await waitFor(() => evaluate(`!!document.querySelector('a[aria-label^="Enlarge"]') && Object.keys(document.querySelector('a[aria-label^="Enlarge"]')).some(key => key.startsWith('__reactProps'))`), "hydrated image link");
    await evaluate(`document.querySelector('a[aria-label^="Enlarge"]').focus(); document.querySelector('a[aria-label^="Enlarge"]').click()`);
    await waitFor(modalOpen, "intercepted image modal");
  };
  const tab = async (key = "Tab", keyCode = 9, modifiers = 0) => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key, code: key, windowsVirtualKeyCode: keyCode, modifiers });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, windowsVirtualKeyCode: keyCode, modifiers });
  };
  await navigate(productPath, heading(sample.name));
  await openImage();
  assert.equal(await evaluate("document.querySelector('main h1').textContent"), sample.name);
  assert.equal(await evaluate("document.activeElement.getAttribute('aria-label')"), "Close image");
  await tab("Tab", 9, 8);
  assert.equal(await evaluate("document.activeElement.tagName"), "A", "Shift+Tab wraps to the last modal control.");
  await tab();
  assert.equal(await evaluate("document.activeElement.getAttribute('aria-label')"), "Close image");
  for (let index = 0; index < 4; index++) {
    await tab();
    assert.ok(await evaluate("!!document.activeElement.closest('dialog')"), "Keyboard focus stays inside the modal.");
  }
  await evaluate(`document.querySelector('[aria-label="Close image"]').click()`);
  await waitFor(modalClosed, "close button");
  await waitFor(() => evaluate(`document.activeElement === document.querySelector('a[aria-label^="Enlarge"]')`), "restored image link focus");
  await evaluate("history.forward()");
  await waitFor(modalOpen, "Forward reopens modal");
  await evaluate("history.back()");
  await waitFor(modalClosed, "Back closes modal");
  await openImage();
  await tab("Escape", 27);
  await waitFor(modalClosed, "Escape closes modal");
  console.log("PASS: image interception keeps product background; close button, focus trap/restoration, Escape, Back and Forward work.");

  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await openImage();
  assert.ok(await evaluate(`(()=>{const box=document.querySelector('dialog').getBoundingClientRect();return box.left>=0&&box.right<=innerWidth&&box.top>=0&&box.bottom<=innerHeight})()`));
  assert.equal(await evaluate("getComputedStyle(document.querySelector('dialog')).backgroundColor"), "rgb(255, 255, 255)");
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 1, y: 1, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 1, y: 1, button: "left", clickCount: 1 });
  await waitFor(modalClosed, "backdrop closes modal");
  await openImage();
  await evaluate(`document.querySelector('dialog a').click()`);
  await waitFor(modalClosed, "soft navigation clears modal slot");
  await openImage();
  await send("Page.reload");
  await waitFor(() => evaluate(`!document.querySelector('dialog') && ${heading(`${sample.name} — Image`)}`), "refresh uses full image page");
  await navigate(imagePath, heading(`${sample.name} — Image`));
  assert.equal(await evaluate("!!document.querySelector('dialog')"), false);
  console.log("PASS: modal fits mobile; backdrop and soft exit clear it; direct entry and refresh render a full image page.");
  await navigate("/product-list", "!!document.querySelector('.product-items')");
  assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"));
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.product-card')).backgroundColor"), "rgb(255, 255, 255)");
  await navigate(productPath, heading(sample.name));
  assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"));
  assert.equal(await evaluate("getComputedStyle(document.querySelector('main')).borderTopLeftRadius"), "16px");
  console.log("PASS: Tailwind utilities apply to catalogue/details and both fit a 390px viewport.");
});
