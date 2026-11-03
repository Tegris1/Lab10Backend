import "dotenv/config";
import { AUTH_BASE_PATH, SIGN_IN_CALLBACK_PATH } from "../lib/auth-paths";
import { parseAuthEnvironment } from "../lib/auth/environment";
import { createAuthOptions } from "../lib/auth/options";

try {
  const environment = parseAuthEnvironment(process.env);
  const options = createAuthOptions(environment);
  console.log("Auth environment validated; credentials omitted.");
  console.log(`GitHub OAuth App homepage: ${options.baseURL}`);
  console.log(`GitHub authorization callback: ${options.baseURL}${AUTH_BASE_PATH}/callback/github`);
  console.log(`Post-login path: ${SIGN_IN_CALLBACK_PATH}`);
  console.log(`GitHub scopes: ${options.socialProviders.github.scope.join(", ")}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Auth configuration validation failed.");
  process.exitCode = 1;
}
