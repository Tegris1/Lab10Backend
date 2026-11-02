import { config } from "dotenv";
import pg from "pg";

config({ quiet: true });

async function checkDatabase() {
  const { DATABASE_URL, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_PORT = "5432" } = process.env;
  if (!DATABASE_URL || !POSTGRES_DB || !POSTGRES_USER || !POSTGRES_PASSWORD) {
    throw new Error("Set DATABASE_URL and POSTGRES_DB/USER/PASSWORD in your local .env.");
  }

  let url;
  try {
    url = new URL(DATABASE_URL);
    if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      (url.port || "5432") !== POSTGRES_PORT ||
      decodeURIComponent(url.pathname.slice(1)) !== POSTGRES_DB ||
      decodeURIComponent(url.username) !== POSTGRES_USER ||
      decodeURIComponent(url.password) !== POSTGRES_PASSWORD) {
      throw new Error("Inconsistent connection settings");
    }
  } catch {
    throw new Error("DATABASE_URL must point to the local Compose database and match POSTGRES_DB/USER/PASSWORD/PORT.");
  }

  const client = new pg.Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 5000 });
  try {
    await client.connect();
    const { rows: [database] } = await client.query(`
      SELECT current_database() AS database, current_user AS username,
             current_setting('server_version') AS version,
             current_setting('server_version_num')::int AS version_number
    `);
    if (database.database !== POSTGRES_DB || database.username !== POSTGRES_USER ||
      Math.floor(database.version_number / 10000) !== 17) {
      throw new Error("The connected database, user, or PostgreSQL major version differs from the Lab 08 configuration.");
    }
    console.log(`Database connection verified: ${database.database}, user ${database.username}, PostgreSQL ${database.version}.`);
  } catch (error) {
    // Connection errors may contain credentials: report only the standard error code.
    const code = /^[A-Z0-9_]+$/.test(error.code ?? "") ? error.code : "unknown";
    throw new Error(`Database verification failed (${code}). Check Docker health, local settings and existing volume credentials.`);
  } finally {
    await client.end();
  }
}

checkDatabase().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
