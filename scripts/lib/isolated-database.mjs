import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";

/**
 * @template T
 * @param {"migration" | "seed" | "integration" | "browser" | "failure" | "persistence"} purpose
 * @param {(connectionString: string) => Promise<T>} verify
 * @returns {Promise<T>}
 */
export async function withIsolatedDatabase(purpose, verify) {
  const appUrl = new URL(process.env.DATABASE_URL ?? "");
  const testUrl = new URL(process.env.TEST_DATABASE_URL ?? "");
  assert.ok(["migration", "seed", "integration", "browser", "failure", "persistence"].includes(purpose));
  assert.ok(["postgres:", "postgresql:"].includes(testUrl.protocol), "Expected a PostgreSQL test URL");
  assert.ok(["localhost", "127.0.0.1"].includes(testUrl.hostname), "Verification requires a local database");
  assert.equal(testUrl.pathname, "/shop_lab08_test", "Expected the dedicated shop_lab08_test database URL");
  assert.notEqual(appUrl.pathname, testUrl.pathname, "The test database must differ from the application database");

  // Never reset an existing database: remove only the uniquely named database we create.
  const databaseName = `shop_lab08_test_${purpose}_${randomBytes(8).toString("hex")}`;
  const validName = /^shop_lab08_test_(?:migration|seed|integration|browser|failure|persistence)_[a-f0-9]{16}$/;
  assert.match(databaseName, validName);
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 5000 });
  let created = false;
  try {
    try {
      await admin.connect();
      await admin.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0 ENCODING 'UTF8'`);
      created = true;
    } finally { await admin.end(); }
    const isolatedUrl = new URL(testUrl);
    isolatedUrl.pathname = `/${databaseName}`;
    const deploy = spawnSync(process.execPath, [
      fileURLToPath(new URL("../../node_modules/prisma/build/index.js", import.meta.url)), "migrate", "deploy",
    ], {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      env: { ...process.env, DATABASE_URL: isolatedUrl.toString() },
      encoding: "utf8", windowsHide: true, timeout: 60000,
    });
    assert.equal(deploy.status, 0, "Local Prisma migrate deploy failed on the new verification database");
    const identityClient = new pg.Client({ connectionString: isolatedUrl.toString(), connectionTimeoutMillis: 5000 });
    try {
      await identityClient.connect();
      const { rows: [identity] } = await identityClient.query("SELECT current_database() AS name");
      assert.equal(identity.name, databaseName, "Refusing to write to an unexpected database");
    } finally {
      await identityClient.end();
    }
    console.log("PASS: migrated a fresh isolated database using saved migration history only.");
    return await verify(isolatedUrl.toString());
  } finally {
    if (created) {
      assert.match(databaseName, validName);
      // Reconnect after callbacks: persistence/outage checks may restart the container.
      const cleanup = new pg.Client({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 5000 });
      try {
        await cleanup.connect();
        await cleanup.query(`DROP DATABASE "${databaseName}"`);
      } finally { await cleanup.end(); }
      console.log("PASS: removed only the temporary verification database; application and test databases untouched.");
    }
  }
}
