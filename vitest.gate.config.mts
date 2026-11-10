import { defineConfig } from "vitest/config";

// Deliberately excluded from the normal unit/integration suite.
export default defineConfig({
  test: { include: [".github/fixtures/ci-gate.failure.test.ts"] },
});
