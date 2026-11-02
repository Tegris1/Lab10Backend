import { defineConfig } from "vitest/config";
import base from "./vitest.config.mjs";

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["tests/integration/**/*.test.ts"],
    exclude: [],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
