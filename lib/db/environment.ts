import type { PoolConfig } from "pg";

export function isLocalDatabaseHost(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "postgres" ||
    hostname === "0.0.0.0" || /^127\./.test(hostname) || ["::1", "[::1]", "::", "[::]"].includes(hostname);
}

export function parseDatabaseURL(value: string | undefined, requireRemote = false): URL {
  if (!value || value.trim() === "") throw new Error("DATABASE_URL is required for the database connection.");
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error("DATABASE_URL must be a PostgreSQL connection URL."); }
  if (value !== value.trim() || /[\u0000-\u001f\u007f]/u.test(value) ||
    !["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.pathname.length < 2 || url.hash) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL with a database name.");
  }
  if (["host", "hostaddr", "port", "database", "dbname", "user", "password"].some(key => url.searchParams.has(key))) {
    throw new Error("DATABASE_URL must specify its connection target in the URL, without query overrides.");
  }
  const local = isLocalDatabaseHost(url.hostname);
  if (requireRemote && local) throw new Error("DATABASE_URL must point to a remote database for Production.");
  if (!local && (url.searchParams.getAll("sslmode").length !== 1 || url.searchParams.get("sslmode") !== "verify-full" ||
    url.searchParams.has("ssl") || url.searchParams.has("uselibpqcompat"))) {
    throw new Error("Remote DATABASE_URL must use sslmode=verify-full without SSL overrides.");
  }
  return url;
}

function integerSetting(input: Record<string, string | undefined>, name: string, fallback: number, maximum: number) {
  const value = input[name];
  if (value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(number) || number > maximum) {
    throw new Error(`${name} must be a positive integer no greater than ${maximum}.`);
  }
  return number;
}

export function getDatabasePoolConfig(input: Record<string, string | undefined>): PoolConfig {
  parseDatabaseURL(input.DATABASE_URL, input.VERCEL_ENV === "production");
  return {
    connectionString: input.DATABASE_URL,
    min: 0,
    max: integerSetting(input, "PG_POOL_MAX", input.VERCEL === "1" ? 3 : 5, 20),
    idleTimeoutMillis: integerSetting(input, "PG_IDLE_TIMEOUT_MS", 5000, 60000),
    connectionTimeoutMillis: integerSetting(input, "PG_CONNECT_TIMEOUT_MS", 10000, 60000),
  };
}
