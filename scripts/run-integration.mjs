import "dotenv/config";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { withIsolatedDatabase } from "./lib/isolated-database.mjs";

function run(args, env = process.env) {
  const child = spawnSync(process.execPath, args, { env, stdio: "inherit", windowsHide: true });
  assert.equal(child.status, 0, "Integration verification failed");
}

run(["scripts/verify-catalog-migration.mjs"]);
run(["node_modules/tsx/dist/cli.mjs", "scripts/verify-catalog-seed.ts"]);
await withIsolatedDatabase("integration", async connectionString => {
  run(["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.integration.config.mts"], {
    ...process.env, DATABASE_URL: connectionString,
  });
});
