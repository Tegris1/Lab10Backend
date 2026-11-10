import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { validateReleaseConfiguration } from "./lib/release-config";

try {
  const runtime = parse(await readFile(".vercel/.env.production.local"));
  const origin = validateReleaseConfiguration(process.env, runtime);
  console.log(`Release configuration verified for ${origin}; credentials omitted.`);
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    console.error("Missing Vercel Production configuration. Run vercel pull --environment=production first.");
  } else {
    console.error(error instanceof Error ? error.message : "Release configuration validation failed.");
  }
  process.exitCode = 1;
}
