export function getLocalDemoDatabaseURL(): string {
  if (process.env.NODE_ENV === "production") throw new Error("Demo fixtures are only available for local development.");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  let url: URL;
  try { url = new URL(connectionString); }
  catch { throw new Error("Demo fixtures require a local PostgreSQL database URL."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.pathname.length < 2) {
    throw new Error("Demo fixtures require a local PostgreSQL database URL.");
  }
  return connectionString;
}
