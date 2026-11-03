import "dotenv/config";
import { betterAuth } from "better-auth";
import { parseAuthEnvironment } from "./lib/auth/environment";
import { createAuthOptions } from "./lib/auth/options";

// CLI-only configuration: no Next.js server-only imports or database connection.
// Generate a temporary schema with --config ./auth.ts --adapter prisma.
export const auth = betterAuth(createAuthOptions(parseAuthEnvironment(process.env)));
