import assert from "node:assert/strict";
import { config } from "dotenv";
import pg from "pg";
import { withIsolatedDatabase } from "./lib/isolated-database.mjs";

config({ quiet: true });

async function expectSqlFailure(client, sql, values, code, constraint) {
  await client.query("SAVEPOINT expected_failure");
  try {
    await client.query(sql, values);
    assert.fail("The database accepted a write that should violate a constraint.");
  } catch (error) {
    assert.equal(error.code, code);
    if (constraint) assert.equal(error.constraint, constraint);
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT expected_failure");
    await client.query("RELEASE SAVEPOINT expected_failure");
  }
}

async function verifySchema(client) {
  const { rows: columns } = await client.query(`
    SELECT column_name, udt_name, datetime_precision, collation_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Product'
  `);
  const field = name => columns.find(column => column.column_name === name);
  assert.equal(field("nameSortKey").collation_name, "C");
  assert.equal(field("date").udt_name, "timestamptz");
  assert.equal(field("date").datetime_precision, 3);
  assert.equal(field("id").column_default, null, "Imported IDs must not use a sequence");

  const { rows: indexes } = await client.query(`
    SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Product'
  `);
  assert.deepEqual(indexes.map(row => row.indexname).sort(), ["Product_code_key", "Product_pkey", "product_category_code_idx"]);

  await client.query("BEGIN");
  try {
    await client.query('INSERT INTO "Category" ("code", "name") VALUES ($1, $2)', ["cpu", "CPU"]);
    const insert = `INSERT INTO "Product"
      ("id", "code", "name", "description", "image", "price", "amount", "date", "nameSortKey", "categoryCode")
      VALUES ($1, $2, $3, 'Migration verification', '/img/cpu.jpg', $4, $5, $6, $7, $8)`;
    const product = [1, "MIGRATE001", "Alpha", 0, 0, "2026-10-01T10:00:00.123Z", "alpha", "cpu"];
    await client.query(insert, product);

    await expectSqlFailure(client, 'UPDATE "Product" SET "id" = 0', [], "23514", "product_id_positive");
    await expectSqlFailure(client, 'UPDATE "Product" SET "id" = -1', [], "23514", "product_id_positive");
    await expectSqlFailure(client, 'UPDATE "Product" SET "price" = -1', [], "23514", "product_price_nonnegative");
    await expectSqlFailure(client, 'UPDATE "Product" SET "amount" = -1', [], "23514", "product_amount_nonnegative");
    for (const field of ["id", "price", "amount"]) {
      await expectSqlFailure(client, `UPDATE "Product" SET "${field}" = 2147483648`, [], "22003");
    }
    for (const code of ["migrate001", "ŻIGRATE001", "MIGRATE0001", "MIGRATE01\n"]) {
      await expectSqlFailure(client, 'UPDATE "Product" SET "code" = $1', [code], "23514", "product_code_format");
    }
    await expectSqlFailure(client, 'UPDATE "Product" SET "name" = $1', [" \t\n"], "23514", "product_name_nonblank");
    await expectSqlFailure(client, 'UPDATE "Product" SET "image" = NULL', [], "23502");
    await expectSqlFailure(client, insert, [2, ...product.slice(1)], "23505", "Product_code_key");
    await expectSqlFailure(client, insert, [1, "MIGRATE002", ...product.slice(2)], "23505", "Product_pkey");
    await expectSqlFailure(client, 'UPDATE "Product" SET "categoryCode" = $1', ["gpu"], "23503", "Product_categoryCode_fkey");
    await expectSqlFailure(client, 'DELETE FROM "Category" WHERE "code" = $1', ["cpu"], "23503", "Product_categoryCode_fkey");
    await expectSqlFailure(client, 'INSERT INTO "Category" ("code", "name") VALUES ($1, $2)', ["other", "Other"], "23514", "category_code_allowed");
    await expectSqlFailure(client, 'UPDATE "Category" SET "name" = $1', ["\t"], "23514", "category_name_nonblank");

    await client.query('UPDATE "Product" SET "id" = 2147483647, "price" = 2147483647, "amount" = 2147483647');
    const { rows: [boundary] } = await client.query('SELECT "id", "price", "amount", "date" FROM "Product"');
    assert.equal(boundary.id, 2147483647);
    assert.equal(boundary.price, 2147483647);
    assert.equal(boundary.amount, 2147483647);
    assert.equal(boundary.date.toISOString(), product[5]);
    await client.query('UPDATE "Product" SET "id" = 1, "price" = 0, "amount" = 0');
    await client.query(insert, [2, "MIGRATE002", "Zebra", 0, 0, "2026-10-01T12:00:00.123+02:00", "zebra", "cpu"]);
    await client.query(insert, [3, "MIGRATE003", "Ąlpha", 0, 0, product[5], "ąlpha", "cpu"]);
    await client.query(insert, [4, "MIGRATE004", " alpha ", 0, 0, product[5], "alpha", "cpu"]);
    const { rows: sorted } = await client.query('SELECT "id", "date" FROM "Product" ORDER BY "nameSortKey", "id"');
    assert.deepEqual(sorted.map(row => row.id), [1, 4, 2, 3]);
    assert.ok(sorted.every(row => row.date.toISOString() === product[5]));
  } finally {
    await client.query("ROLLBACK");
  }
  console.log("PASS: constraints, integer boundaries, category deletion, indexes, UTF-8 ordering and timestamp precision.");
}

async function verifyMigration() {
  await withIsolatedDatabase("migration", async connectionString => {
    const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
    try {
      await client.connect();
      await verifySchema(client);
    } finally {
      await client.end();
    }
  });
}

verifyMigration().catch(() => {
  // Avoid leaking credentials from driver or configuration exceptions.
  console.error("Migration verification failed. Check local test settings, database readiness and the reviewed migration SQL.");
  process.exitCode = 1;
});
