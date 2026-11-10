import "dotenv/config";
import { parseAuthEnvironment } from "../lib/auth/environment";
import { getDatabasePoolConfig } from "../lib/db/environment";

try {
  if (process.env.VERCEL_ENV === "preview") {
    throw new Error("Preview deployment is disabled for this release. Configure an isolated environment before enabling Preview.");
  }
  const auth = parseAuthEnvironment(process.env, { enforceSecretLength: process.env.CI !== "true" });
  const pool = getDatabasePoolConfig(process.env);
  console.log("Deployment environment validated; credential values omitted.");
  console.log(`OAuth homepage: ${auth.baseURL}`);
  console.log(`OAuth callback: ${auth.baseURL}/api/auth/callback/github`);
  console.log(`Database pool per process: max=${pool.max}, idle=${pool.idleTimeoutMillis}ms, connect=${pool.connectionTimeoutMillis}ms.`);
  console.log("Build generates Prisma Client and never migrates or seeds. The release workflow applies migrations separately; initial catalogue seeding remains manual.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Deployment environment validation failed.");
  process.exitCode = 1;
}
