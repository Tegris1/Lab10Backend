import "dotenv/config";
import { withIsolatedDatabase } from "./lib/isolated-database.mjs";
import { runNode, seedDatabase } from "./lib/run-local.mjs";

await withIsolatedDatabase("browser", async connectionString => {
  seedDatabase(connectionString);
  const environment = { DATABASE_URL: connectionString };
  runNode(["scripts/verify-browser.mjs"], environment);
  runNode(["scripts/verify-extensions.mjs"], environment);
  runNode(["node_modules/tsx/dist/cli.mjs", "scripts/verify-cart.mjs"], environment);
  runNode(["node_modules/tsx/dist/cli.mjs", "scripts/verify-auth.ts"], environment);
  runNode(["scripts/verify-order-history.mjs"], environment);
  runNode(["node_modules/tsx/dist/cli.mjs", "scripts/verify-basket-ui.ts"], environment);
});
