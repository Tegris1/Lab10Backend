import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { getAuthEnvironment } from "./auth-env";
import { createAuthOptions } from "./auth/options";
import { prisma } from "./db/prisma";

export const auth = betterAuth({
  ...createAuthOptions(getAuthEnvironment()),
  database: prismaAdapter(prisma, { provider: "postgresql" }),
});
