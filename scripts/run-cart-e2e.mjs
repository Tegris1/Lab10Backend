import "dotenv/config";
import assert from "node:assert/strict";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { withIsolatedDatabase } from "./lib/isolated-database.mjs";
import { runNode, seedDatabase } from "./lib/run-local.mjs";

const artifacts = new URL("../.tools/cart-e2e/", import.meta.url);
const startedAt = new Date();
await mkdir(artifacts, { recursive: true });
for (const name of ["desktop.png", "mobile.png", "failure.png"]) {
  await rm(new URL(name, artifacts), { force: true });
}
let passed = false;

try {
  await access(new URL("../.next/BUILD_ID", import.meta.url)).catch(() => {
    throw new Error("Build the application first: npm run build.");
  });
  assert.ok(process.env.DATABASE_URL, "Set DATABASE_URL for your application (it is not queried by this runner).");
  assert.ok(process.env.TEST_DATABASE_URL, "Set TEST_DATABASE_URL to the local shop_lab08_test connection with CREATE DATABASE permission.");
  await withIsolatedDatabase("browser", async connectionString => {
    seedDatabase(connectionString);
    runNode(["node_modules/tsx/dist/cli.mjs", "scripts/verify-basket-ui.ts"], {
      DATABASE_URL: connectionString,
      // These credentials belong only to this disposable local test process.
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "cart-e2e-only-fictional-secret-at-least-32-characters",
      GITHUB_CLIENT_ID: "cart-e2e-fictional-client-id",
      GITHUB_CLIENT_SECRET: "cart-e2e-fictional-client-secret",
      VERCEL: "", VERCEL_ENV: "",
    });
  });
  passed = true;
  console.log("PASS: basket browser test completed and its temporary database was removed.");
} catch (error) {
  // Never serialize captured requests, session cookies or database connection strings.
  console.error("Basket E2E failed:", error instanceof Error ? error.message : "Unknown failure");
  process.exitCode = 1;
} finally {
  await writeFile(new URL("result.json", artifacts), JSON.stringify({
    suite: "cart-e2e", status: passed ? "passed" : "failed",
    startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
  }, null, 2) + "\n");
}
