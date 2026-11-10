import { parseAuthEnvironment } from "../../lib/auth/environment";
import { getDatabasePoolConfig, parseDatabaseURL } from "../../lib/db/environment";

export function productionOrigin(value: string | undefined): string {
  let url: URL;
  try { url = new URL(value ?? ""); }
  catch { throw new Error("PRODUCTION_URL must be the stable HTTPS Production origin."); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("PRODUCTION_URL must be an HTTPS origin without credentials, path, query or fragment.");
  }
  return url.origin;
}

export function validateReleaseConfiguration(
  input: Record<string, string | undefined>,
  runtime: Record<string, string | undefined>,
): string {
  const origin = productionOrigin(input.PRODUCTION_URL);
  const environment = { ...runtime, VERCEL: "1", VERCEL_ENV: "production" };
  const auth = parseAuthEnvironment(environment);
  getDatabasePoolConfig(environment);
  if (auth.baseURL !== origin) throw new Error("Production BETTER_AUTH_URL must match PRODUCTION_URL exactly.");
  if (!input.MIGRATION_DATABASE_URL) throw new Error("MIGRATION_DATABASE_URL is required in the production GitHub Environment.");
  const direct = parseDatabaseURL(input.MIGRATION_DATABASE_URL, true);
  if (direct.hostname === "pooled.db.prisma.io") {
    throw new Error("MIGRATION_DATABASE_URL must use the direct Prisma Postgres endpoint, not its pooler.");
  }
  const pooled = parseDatabaseURL(runtime.DATABASE_URL, true);
  if (["db.prisma.io", "pooled.db.prisma.io"].includes(pooled.hostname) &&
    (direct.hostname !== "db.prisma.io" || direct.username !== pooled.username || direct.pathname !== pooled.pathname)) {
    throw new Error("Prisma Postgres runtime and migration connections must identify the same database credential and direct/pooled pair.");
  }
  return origin;
}
