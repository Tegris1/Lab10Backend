"use client";
import { createAuthClient } from "better-auth/react";
import { AUTH_BASE_PATH } from "./auth-paths";

export const authClient = createAuthClient({ basePath: AUTH_BASE_PATH });
