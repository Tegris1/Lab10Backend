export type AuthEnvironment = {
  secret: string;
  baseURL: string;
  githubClientId: string;
  githubClientSecret: string;
  databaseURL: string;
};

// Pure validation shared by the server and the standalone CLI. Never logs input values.
export function parseAuthEnvironment(input: Record<string, string | undefined>): AuthEnvironment {
  function required(name: string): string {
    const value = input[name];
    if (!value || value.trim() === "") throw new Error(`${name} is required.`);
    if (value !== value.trim() || /[\u0000-\u001f\u007f]/u.test(value)) {
      throw new Error(`${name} must not contain surrounding whitespace or control characters.`);
    }
    return value;
  }

  const secret = required("BETTER_AUTH_SECRET");
  if (secret.length < 32) throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");

  const rawBaseURL = required("BETTER_AUTH_URL");
  let baseURL: URL;
  try { baseURL = new URL(rawBaseURL); }
  catch { throw new Error("BETTER_AUTH_URL must be an absolute HTTP or HTTPS URL."); }
  if (!["http:", "https:"].includes(baseURL.protocol) || baseURL.username || baseURL.password ||
    baseURL.pathname !== "/" || baseURL.search || baseURL.hash) {
    throw new Error("BETTER_AUTH_URL must be an HTTP or HTTPS origin without credentials, path, query or fragment.");
  }

  const githubClientId = required("GITHUB_CLIENT_ID");
  const githubClientSecret = required("GITHUB_CLIENT_SECRET");
  const databaseURL = required("DATABASE_URL");
  let database: URL;
  try { database = new URL(databaseURL); }
  catch { throw new Error("DATABASE_URL must be a PostgreSQL connection URL."); }
  if (!["postgres:", "postgresql:"].includes(database.protocol) || !database.hostname || database.pathname.length < 2) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL with a database name.");
  }

  return { secret, baseURL: baseURL.origin, githubClientId, githubClientSecret, databaseURL };
}
