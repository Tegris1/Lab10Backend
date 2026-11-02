import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

export function runNode(args, environment = {}) {
  const child = spawnSync(process.execPath, args, {
    env: { ...process.env, ...environment }, stdio: "inherit", windowsHide: true, timeout: 180000,
  });
  assert.equal(child.status, 0, `Local command failed: ${args[0]}`);
}

export function seedDatabase(connectionString) {
  runNode(["node_modules/prisma/build/index.js", "db", "seed"], { DATABASE_URL: connectionString });
}
