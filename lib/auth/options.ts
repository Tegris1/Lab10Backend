import type { BetterAuthOptions } from "better-auth";
import { AUTH_BASE_PATH } from "../auth-paths";
import type { AuthEnvironment } from "./environment";

// Shared server/CLI settings. The runtime will supply the existing Prisma adapter.
export function createAuthOptions(environment: AuthEnvironment) {
  return {
    baseURL: environment.baseURL,
    basePath: AUTH_BASE_PATH,
    secret: environment.secret,
    trustedOrigins: [environment.baseURL],
    // Re-read PostgreSQL on each protected request so revocation applies across devices immediately.
    session: { storeSessionInDatabase: true, cookieCache: { enabled: false } },
    socialProviders: {
      github: {
        clientId: environment.githubClientId,
        clientSecret: environment.githubClientSecret,
        scope: ["read:user", "user:email"],
      },
    },
    advanced: { disableCSRFCheck: false, disableOriginCheck: false },
    onAPIError: { errorURL: "/sign-in" },
  } satisfies BetterAuthOptions;
}
