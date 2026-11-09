import "dotenv/config";
import { parseArgs } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Client } from "pg";
import { parseDatabaseURL } from "../lib/db/environment";
import { logServerError } from "../lib/logging";

class PreflightError extends Error {}
function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new PreflightError(message);
}

const tables = ["Category", "Product", "User", "Session", "Account", "Verification", "Cart", "CartItem", "Order", "OrderItem"];
const rights = tables.flatMap(table => {
  const privileges = ["Category", "Product"].includes(table) ? ["SELECT"]
    : ["Order", "OrderItem"].includes(table) ? ["SELECT", "INSERT"] : ["SELECT", "INSERT", "UPDATE", "DELETE"];
  return privileges.map(privilege => ({ table_name: table, privilege }));
});

async function verifySchema(client: Client, migrationRole: boolean) {
  const { rows: columns } = await client.query<{ table_name: string; column_name: string; collation_name: string | null; udt_name: string; datetime_precision: number | null }>(`
    SELECT table_name, column_name, collation_name, udt_name, datetime_precision
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ANY($1::text[])
  `, [tables]);
  for (const table of tables) requireCondition(columns.some(column => column.table_name === table), `Missing or inaccessible table: ${table}. Apply migrations and runtime grants.`);
  requireCondition(columns.some(column => column.table_name === "Product" && column.column_name === "nameSortKey" && column.collation_name === "C"), "Product.nameSortKey must use collation C.");
  requireCondition(columns.some(column => column.table_name === "Product" && column.column_name === "date" && column.udt_name === "timestamptz" && column.datetime_precision === 3), "Product.date must preserve UTC timestamps with millisecond precision.");
  requireCondition(columns.some(column => column.table_name === "Order" && column.column_name === "requestKey"), "The checkout migration is missing.");

  const { rows: collations } = await client.query<{ name: string }>(`SELECT collname AS name FROM pg_collation WHERE collname IN ('C', 'pl-PL-x-icu')`);
  requireCondition(collations.some(row => row.name === "pl-PL-x-icu"), "The provider must support pl-PL-x-icu for the existing catalogue sort modes.");

  const { rows: constraints } = await client.query<{ name: string; delete_action: string; definition: string }>(`
    SELECT con.conname AS name, con.confdeltype AS delete_action, pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con JOIN pg_namespace ns ON ns.oid = con.connamespace WHERE ns.nspname = 'public'
  `);
  for (const name of ["product_id_positive", "product_code_format", "product_price_nonnegative", "product_amount_nonnegative",
    "category_code_allowed", "cart_item_quantity_range", "order_total_nonnegative", "order_item_quantity_positive", "order_item_price_nonnegative", "order_request_key_uuid"]) {
    requireCondition(constraints.some(row => row.name === name), `Missing database constraint: ${name}.`);
  }
  const quantityCheck = constraints.find(row => row.name === "cart_item_quantity_range")!.definition.replace(/[\s"()]/g, "");
  requireCondition(quantityCheck.includes("quantity>=1") && quantityCheck.includes("quantity<=99"), "The database must enforce basket quantities from 1 to 99.");
  for (const [name, action] of [["Product_categoryCode_fkey", "r"], ["Cart_userId_fkey", "c"], ["CartItem_cartId_fkey", "c"],
    ["CartItem_productId_fkey", "r"], ["OrderItem_productId_fkey", "n"], ["Session_userId_fkey", "c"]]) {
    requireCondition(constraints.some(row => row.name === name && row.delete_action === action), `Missing or incorrect foreign-key deletion policy: ${name}.`);
  }

  const { rows: indexes } = await client.query<{ name: string; unique: boolean }>(`
    SELECT rel.relname AS name, idx.indisunique AS unique FROM pg_index idx
    JOIN pg_class rel ON rel.oid = idx.indexrelid JOIN pg_namespace ns ON ns.oid = rel.relnamespace WHERE ns.nspname = 'public'
  `);
  for (const name of ["Product_code_key", "Cart_userId_key", "CartItem_cartId_productId_key", "Session_token_key", "Account_providerId_accountId_key", "Order_number_key", "Order_userId_requestKey_key"]) {
    requireCondition(indexes.some(row => row.name === name && row.unique), `Missing unique index: ${name}.`);
  }
  if (!migrationRole) {
    const { rows: owners } = await client.query<{ owns_table: boolean }>(`
      SELECT pg_has_role(current_user, rel.relowner, 'USAGE') AS owns_table FROM pg_class rel
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
      WHERE ns.nspname = 'public' AND rel.relname = ANY($1::text[]) AND rel.relkind IN ('r', 'p')
    `, [tables]);
    requireCondition(owners.every(row => !row.owns_table), "The runtime role must not own the application tables or inherit the migration owner's privileges.");
    const { rows: permissions } = await client.query<{ allowed: boolean }>(`
      SELECT has_table_privilege(current_user, format('public.%I', required.table_name), required.privilege) AS allowed
      FROM jsonb_to_recordset($1::jsonb) AS required(table_name text, privilege text)
    `, [JSON.stringify(rights)]);
    requireCondition(permissions.every(row => row.allowed), "The runtime role is missing required table permissions. Apply scripts/sql/runtime-grants.sql as the migration role.");
    const { rows: [stockPermission] } = await client.query<{ allowed: boolean }>(`SELECT has_column_privilege(current_user, 'public."Product"', 'amount', 'UPDATE') AS allowed`);
    requireCondition(stockPermission.allowed, "The runtime role needs UPDATE permission on Product.amount for checkout.");
    const { rows: sequences } = await client.query<{ allowed: boolean }>(`
      SELECT has_sequence_privilege(current_user, seq.oid, 'USAGE') AS allowed FROM pg_class seq
      JOIN pg_namespace ns ON ns.oid = seq.relnamespace WHERE ns.nspname = 'public' AND seq.relkind = 'S'
    `);
    requireCondition(sequences.every(row => row.allowed), "The runtime role is missing sequence permissions.");
  }
  console.log("Schema, collations, constraints, unique indexes and applicable runtime grants verified.");

  if (migrationRole) {
    const { rows: applied } = await client.query<{ migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null }>(`
      SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"
    `);
    requireCondition(!applied.some(row => !row.finished_at && !row.rolled_back_at), "An unfinished migration exists. Stop the release and diagnose it.");
    const directory = new URL("../prisma/migrations/", import.meta.url);
    const names = (await readdir(directory, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
    for (const name of names) {
      const sql = await readFile(new URL(`${name}/migration.sql`, directory), "utf8");
      const hashes = [sql, sql.replace(/\r\n/g, "\n"), sql.replace(/\r?\n/g, "\r\n")]
        .map(text => createHash("sha256").update(text).digest("hex"));
      requireCondition(applied.some(row => row.migration_name === name && row.finished_at && !row.rolled_back_at && hashes.includes(row.checksum)), `Migration missing or SQL history differs from the applied version: ${name}.`);
    }
    requireCondition(applied.filter(row => row.finished_at && !row.rolled_back_at).every(row => names.includes(row.migration_name)), "The database contains migrations absent from this checkout. Stop the release and reconcile its revision.");
    console.log("Saved migration history matches the applied migrations; this is not a full schema drift comparison.");
  }
}

async function main() {
  let values;
  try {
    ({ values } = parseArgs({ options: { role: { type: "string", default: "runtime" }, stage: { type: "string", default: "schema" }, help: { type: "boolean" } }, strict: true, allowPositionals: false }));
  } catch { throw new PreflightError("Use --role runtime|migration --stage connection|schema|catalog. No connection URL belongs in command arguments."); }
  if (values.help) {
    console.log("Usage: npm run db:check:remote -- --role runtime|migration --stage connection|schema|catalog");
    console.log("Reads DATABASE_URL from the process environment. All database queries run in a read-only transaction.");
    return;
  }
  requireCondition(["runtime", "migration"].includes(values.role), "Choose --role runtime or --role migration.");
  requireCondition(["connection", "schema", "catalog"].includes(values.stage), "Choose --stage connection, schema or catalog.");
  let target: URL;
  try { target = parseDatabaseURL(process.env.DATABASE_URL, true); }
  catch (error) { throw new PreflightError(error instanceof Error ? error.message : "Invalid DATABASE_URL."); }
  console.log(`Checking remote target ${target.hostname}${target.pathname}; credentials omitted. Role purpose: ${values.role}.`);
  const client = new Client({ connectionString: target.toString(), connectionTimeoutMillis: 10000, query_timeout: 10000, application_name: "shop-release-preflight" });
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    const { rows: [server] } = await client.query<{ version: number; superuser: boolean; create_db: boolean; create_role: boolean; bypass_rls: boolean; ddl: boolean }>(`
      SELECT current_setting('server_version_num')::int AS version, rolsuper AS superuser, rolcreatedb AS create_db,
        rolcreaterole AS create_role, rolbypassrls AS bypass_rls, has_schema_privilege(current_user, 'public', 'CREATE') AS ddl
      FROM pg_roles WHERE rolname = current_user
    `);
    requireCondition(Math.floor(server.version / 10000) === 17, "This release requires PostgreSQL 17.");
    if (values.role === "migration") requireCondition(server.ddl, "The migration role needs CREATE privilege on public and ownership of the migrated tables.");
    else requireCondition(!server.superuser && !server.create_db && !server.create_role && !server.bypass_rls && !server.ddl, "The runtime role must not be a privileged administration or migration role.");
    console.log("PostgreSQL 17 connection and role separation verified; TLS certificate verification is required by the URL.");
    if (values.stage !== "connection") await verifySchema(client, values.role === "migration");
    if (values.stage === "catalog") {
      const { rows: [counts] } = await client.query<{ categories: number; products: number }>(`SELECT (SELECT count(*)::int FROM "Category") AS categories, (SELECT count(*)::int FROM "Product") AS products`);
      requireCondition(counts.categories === 4 && counts.products === 100, "The initial catalogue must contain four categories and 100 products.");
      console.log("Initial catalogue contains four categories and 100 products.");
    }
    await client.query("ROLLBACK");
  } finally { await client.end(); }
}

main().catch(error => {
  if (error instanceof PreflightError) console.error(error.message);
  else { logServerError("deployment.database-preflight", error); console.error("Remote database verification failed. Check provider connectivity, role grants and migration state."); }
  process.exitCode = 1;
});
