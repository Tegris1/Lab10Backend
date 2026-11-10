# Lab 10 deployment runbook

This runbook covers the basic deployment requirements in sections 1–9 and the basket browser-test and automatic CI/CD extensions from section 10. README is intentionally unchanged.

## Release configuration

| Item | Configuration |
| --- | --- |
| Development branch | `lab10` |
| Production branch | `main` |
| Hosting | Vercel, Next.js preset, Node.js **24.x** |
| Install command | `npm ci --include=dev` |
| Build command | `npm run build` |
| Runtime | Node.js, explicitly set in the root layout and database API handlers |
| Application region | `fra1` (Frankfurt) in `vercel.json`; change it if the selected database is elsewhere |
| Database | PostgreSQL **17**, remote provider and nearby region still to be selected/recorded |
| Preview | Disabled; no Production secrets are assigned to Preview or pull-request code |
| Release method | GitHub Actions publishes the verified `main` SHA after checks pass on pushes and manual runs |
| Stable HTTPS address | Pending Vercel setup; record the actual value in `ACCEPTANCE.md` |

The project retains Next.js 16.3.8 and Prisma/client/adapter 7.10.1. `package-lock.json` pins application installations. `@vercel/functions` 3.10.6 manages idle connections on Vercel. The release job invokes Vercel CLI 65.3.1 explicitly, matching the supplied reference.

Vercel Hobby does not deploy private GitHub organization repositories. If that affects the course repository, use an allowed private personal repository preserving its history and keep the course repository/PR as required by the lecturer. Do not make course material public to bypass this restriction.

## Environment variables

Store actual values in Vercel's **Production** environment and in protected local operator environments. `.env.example` contains placeholders only. A changed Vercel variable requires a new deployment.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Runtime-role PostgreSQL TCP URL, normally the provider's pooled endpoint; remote URLs accept `sslmode=require` or `sslmode=verify-full`. The app normalizes `require` to `verify-full`. |
| `BETTER_AUTH_URL` | Stable Production HTTPS origin, with no path/query; never a changing Preview URL |
| `BETTER_AUTH_SECRET` | Separate random Production secret of at least 32 characters; keep stable across releases to preserve sessions |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | A separate Production GitHub **OAuth App** |
| `PG_POOL_MAX` | Connections per application process: default 3 on Vercel, 5 locally; allowed range 1–20 |
| `PG_IDLE_TIMEOUT_MS` | Idle timeout, default 5000 ms |
| `PG_CONNECT_TIMEOUT_MS` | Connection timeout, default 10000 ms; account for provider wake-up time |

`VERCEL` and `VERCEL_ENV` are supplied by Vercel. Do not set Production flags in the local development `.env`. The build refuses Preview and rejects localhost/HTTP settings in Production. No credential uses `NEXT_PUBLIC_`.

For the Production OAuth App set:

```text
Homepage: https://YOUR-STABLE-DOMAIN
Authorization callback: https://YOUR-STABLE-DOMAIN/api/auth/callback/github
```

Keep localhost credentials separate. Better Auth trusts exactly `BETTER_AUTH_URL`, retains origin/CSRF checks, and derives secure cookie behavior from HTTPS. Cookie session caching remains disabled, so protected operations consult the database after revocation.

Check configuration without printing credentials:

```powershell
npm run deploy:check
```

## Prepare the remote database once

1. Select PostgreSQL 17 and a region near `fra1`, or update the Vercel region to match. Confirm connection limits, compute/storage allowances, sleep behavior, direct/pooled endpoints and certificate support in the provider console.
2. Create an empty demonstration database. Verify that the provider supports both `C` and `pl-PL-x-icu` collations used by the existing catalogue.
3. Create a migration/owner login and a separate runtime login. The runtime login must have no administration privileges, table ownership or membership in the migration owner role. Create passwords in the provider's protected console, not in SQL files in this repository.
4. Open a separate operator terminal with the **direct migration-role URL injected as `DATABASE_URL`**. `dotenv/config` does not overwrite an existing process variable. This does not change the Vercel runtime variable.
5. From the exact release checkout, install dependencies, generate the client, inspect the target and apply the saved SQL:

   ```powershell
   npm ci --include=dev
   npm run db:generate
   npm run db:check:remote -- --role migration --stage connection
   npm run db:migrate:deploy
   npm run db:migrate:status
   npm run db:check:remote -- --role migration --stage schema
   ```

6. As the migration owner, apply the runtime grants:

   ```text
   psql --set=ON_ERROR_STOP=1 --set=runtime_role=shop_runtime --file=scripts/sql/runtime-grants.sql
   ```

   Configure `psql` with a secure service or `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` and `PGSSLMODE=verify-full` in the operator process. Unlike Prisma, `psql` does not automatically read `DATABASE_URL`. Use the same target verified above. The runtime login must already exist; replace `shop_runtime` with its actual name. The script grants catalogue reads, checkout stock updates, auth/basket writes and order creation, plus sequence usage. It does not grant access to `_prisma_migrations` or ownership. Reapply it after later migrations; grant new tables explicitly.
7. Still using the migration/owner connection, seed **only during initial catalogue setup**:

   ```powershell
   npm run db:seed
   npm run db:check:remote -- --role migration --stage catalog
   ```

8. In a new terminal with the **runtime URL** injected as `DATABASE_URL`, verify access:

   ```powershell
   npm run db:check:remote -- --role runtime --stage catalog
   ```

The remote verification command uses a read-only transaction and prints target host/database, never passwords or complete URLs. It checks version, role separation, tables, key constraints, collations and permissions. The migration-role schema check also compares saved migration checksums. This is not a complete schema drift detector; inspect any manual schema changes separately.

Never use `migrate dev`, `migrate reset` or `db push` against the shared remote database. A failed migration stops publication. Diagnose and use a reviewed migration recovery procedure; do not reset the database. Applied migration files must retain their original content.

## Build and CI

`npm run build` runs generation, environment validation and Next.js compilation. It never migrates or seeds the database. The generated client remains ignored by Git. Installation includes development dependencies because Prisma CLI is needed during building.

`.github/workflows/ci.yml` runs on `main`/`lab10` pushes, PRs to `main`, and manual dispatch. It uses Node.js 24, a PostgreSQL 17 service and only fictional credentials. It generates the client once, runs lint, real unit tests, integration checks on uniquely named temporary databases, then builds. After the build it runs the standalone basket browser test with the runner's Google Chrome. The integration role can create/drop those databases only in the disposable service.

To repeat the checks in a clean checkout, use local `.env` values and a separate `TEST_DATABASE_URL` as described in `.env.example`:

```powershell
npm ci --include=dev
npm run ci:check
npm run test:e2e:cart
```

CI results must be obtained before declaring a release accepted. The new standalone basket browser test is part of this CI job. The older combined `test:browser` command still includes legacy demo-history scenarios and is not used as this extension's acceptance test.

Local implementation verification completed: the working-copy lint/build passed, and a separate source snapshot installed with `npm ci --include=dev`, passed lint, and built after clearing generated Prisma output and build artifacts. That snapshot used fictional environment values and no real `.env` or database connection. Vercel/GitHub Actions execution and Production acceptance remain pending.

## Basket browser-test extension

Run `npm run test:e2e:cart` after building the application. It runs only the basket UI scenario, using the existing Chrome DevTools browser helper. It starts and stops its own production-mode Next.js server and headless Edge/Chrome with a disposable profile. Do not start another test server for this command.

Prerequisites: installed dependencies, generated Prisma Client, production build, a running **local** PostgreSQL 17 with `CREATE DATABASE` permission, and Edge/Chrome/Chromium. `DATABASE_URL` identifies the application configuration but the runner never queries it. `TEST_DATABASE_URL` must point to localhost/127.0.0.1 with the dedicated name `shop_lab08_test`, different from the application database name. Each run creates, migrates and seeds a random `shop_lab08_test_browser_<suffix>` database, then drops only that database, including after a failed assertion. Never use the Vercel/Prisma Postgres URL as `TEST_DATABASE_URL`.

For a local PostgreSQL instance matching `.env.example`, run in a separate PowerShell terminal (adjust the local database port and credentials as needed):

```powershell
$env:DATABASE_URL='postgresql://shop_lab08:password@localhost:5432/shop_lab08'
$env:TEST_DATABASE_URL='postgresql://shop_lab08:password@localhost:5432/shop_lab08_test'
$env:BETTER_AUTH_URL='http://localhost:3000'
$env:BETTER_AUTH_SECRET='local-e2e-fictional-secret-at-least-32-characters'
$env:GITHUB_CLIENT_ID='fictional-e2e-client-id'
$env:GITHUB_CLIENT_SECRET='fictional-e2e-client-secret'
npm run build
npm run test:e2e:cart
```

The runner supplies its own fictional auth configuration to the test server and helper; no real GitHub credentials or GitHub login are needed. `createBrowserSession` creates a real database-backed Better Auth session only for the isolated local database. No application login bypass or test endpoint is added. Override `BROWSER_PATH` if the browser is installed outside the detected locations. On CI, the workflow resolves the installed `google-chrome` executable explicitly.

Coverage: adding from catalogue/details, changing quantities and totals, removing a product and reaching an empty basket, stock/quantity validation, user isolation, foreign-origin refusal and revoked-session refusal. The test captures actual add/update/remove Server Action requests and replays each with an absent cookie and a forged cookie. Every refusal checks `AUTH_REQUIRED` and unchanged baskets, basket items and product stock in PostgreSQL.

Results are written to `.tools/cart-e2e/result.json`, with desktop/mobile screenshots on success and `failure.png` when a browser scenario fails. CI uploads only this directory as `cart-e2e-<SHA>` for seven days, even when the test fails. It does not upload captured requests, session cookies or database URLs. A nonzero exit code fails the CI job. Maintenance cost: browser execution time in CI, artifact storage, and updates to selectors/session helpers when UI or Better Auth changes.

Local acceptance: the full basket test passed against disposable PostgreSQL 17 and headless Edge. A controlled local mutation temporarily bypassed `requireSession` in the compiled `.next` artifact; the test failed with `Adding without a session must not create a basket item`. The original artifact was restored. Source application authentication and Production were not changed. Local lint, 178 unit tests, 43 integration tests and the production build also passed. GitHub-hosted execution remains to be confirmed after pushing the changes.

CI preflight checks (`deploy:check` and `release:check`) do not enforce the custom 32-character auth-secret minimum when `CI=true`. Missing or malformed secrets are still rejected. The application runtime retains its existing minimum, including when started in CI; a short Production secret can still fail application initialization during the build or at runtime.

## Automatic CI/CD: configure once

The workflow follows the supplied check-then-deploy reference. GitHub checks the source using a disposable PostgreSQL service; after successful checks, Vercel builds and deploys that same source using the existing project's Production configuration.

In GitHub, create an Environment named **`production`**, restricted to `main`, and add these **Environment secrets**:

| Secret | Value |
| --- | --- |
| `VERCEL_TOKEN` | Vercel access token authorized to deploy the existing project |
| `VERCEL_ORG_ID` | Team/account ID from `.vercel/project.json` (`orgId`) |
| `VERCEL_PROJECT_ID` | Existing Vercel project ID (`projectId`) |

These are the only GitHub settings required by the deploy job. `PRODUCTION_URL`, `MIGRATION_DATABASE_URL` and an automation bypass secret are not read by this workflow. The optional standalone `release:check` and `release:verify` tools remain available, with their own configuration requirements, but are not automatic deployment gates.

Keep `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, and GitHub OAuth credentials in **Vercel Production**. Vercel uses those variables for its remote build and running application. CI uses fictional credentials for its separate local PostgreSQL service. The existing application validation still applies to Production configuration.

Keep `git.deploymentEnabled: false` in `vercel.json` so Vercel's Git integration cannot publish independently before Actions checks pass. The authenticated CLI deployment is the publication path. The workflow does not enable Preview or create a second hosted application.

## Publish a specific revision

1. Apply any pending, reviewed Production migrations separately with the direct migration/owner connection, following the remote database procedure above. Stop the release if migration fails. The workflow never migrates or seeds Production; initial catalogue seeding remains a separate one-time operator action. Plan schema changes for compatibility with the currently running application.
2. Push changes to `lab10` and open the PR to `main`. PR and branch checks use only fictional credentials and temporary local PostgreSQL 17 databases.
3. A `main` push runs schema validation, Prisma generation, lint, unit/integration tests, the production-mode test build and basket browser E2E. `deploy` declares `needs: check`, so failed or canceled checks prevent publication.
4. The deploy job uses the `production` Environment, checks out `${{ github.sha }}`, and invokes `npx --yes vercel@65.3.1 deploy --prod --yes` with commit metadata. Vercel installs dependencies and executes `npm run build` using its Production variables. No prebuilt artifact or downloaded Production environment file is needed on the GitHub runner.
5. Successful manual runs on **`main` publish a real Production deployment too**. Manual runs on `lab10` verify only. Production deployments are serialized with `cancel-in-progress: false`.
6. Record the deployment URL and commit SHA from the job summary or `release-<SHA>` artifact, retained for 14 days. Inspect the Vercel deployment's commit metadata and complete the stable-domain acceptance checks. A successful CLI deployment alone does not establish catalogue, OAuth or basket acceptance.

## Demonstrate that a failed test blocks publication

Use GitHub Actions -> **Lab 10 CI/CD -> Run workflow**, selecting `main`.

1. Record the currently active Vercel deployment ID.
2. Enable **`fail_test`** and run the workflow. The dedicated `test:ci-gate:failure` fixture deliberately fails a Vitest assertion. The `check` job fails, `deploy` is skipped, and the active Production deployment must remain unchanged.
3. Run again with **`fail_test` disabled**. All normal checks and basket E2E must pass, then the deploy job publishes to Vercel. Record the new deployment ID, source SHA, public URL and both Actions run links.

Manual runs are no longer rehearsals. Do not expect a successful manual `main` run to leave Production unchanged. The deliberate failure fixture remains excluded from normal test suites.

Local validation of this revision passed: actionlint, lint, 178 unit tests, 43 integration tests, the production build and basket browser E2E. The deliberate failure fixture returned exit code 1 as expected. Vercel CLI 65.3.1 deployment flags were checked through its help output without authentication or publication. Local checks cannot prove that a hosted deployment succeeded. Fill in `ACCEPTANCE.md` after running the updated workflow on GitHub. Maintenance cost: Actions minutes for verification, Vercel build/deployment usage, pinned CLI/action updates, token rotation and short-lived artifact storage.

## Diagnostics

### Prisma Postgres: catalogue and GitHub sign-in both fail

Both features use `lib/db/prisma.ts`. Successful table creation proves the migration connection worked; it does not prove that the deployed application's connection works or that products were imported.

1. In Prisma Console, open the existing database's connection settings and copy its **pooled PostgreSQL TCP** URL. Its format is `postgres://USER:PASSWORD@pooled.db.prisma.io:5432/postgres?sslmode=require`. Set it as **`DATABASE_URL`** in Vercel's Production environment. The app does not read `POSTGRES_URL` or `PRISMA_DATABASE_URL`, and the `pg` adapter cannot use a `prisma://` or `prisma+postgres://` Accelerate URL. Do not try to convert an Accelerate API key into a PostgreSQL password.
2. This revision accepts the provider's `sslmode=require` and explicitly upgrades it to `verify-full` before creating the runtime pool. Earlier revisions rejected it before attempting a connection. Deploy the updated revision after changing environment variables.
3. In a protected operator terminal with the **same runtime URL** injected as `DATABASE_URL`, run:

   ```powershell
   npm run db:generate
   npm run db:check:prisma
   ```

   This command uses the application's pool configuration and Prisma adapter, performs a read-only transaction, checks catalogue/auth table access, and reports category/product counts without printing credentials or user records. It works with managed-provider credentials and does not require local `POSTGRES_DB`/`POSTGRES_USER` settings. Unlike `db:check:remote`, it does not enforce the separate-role deployment policy. A failure reports a safe error code for the runtime logs.
4. If the product count is zero, use the **direct owner connection for that same database** in a separate terminal and run `npm run db:seed` once. Creating tables and running migrations do not seed products. Do not reseed a populated catalogue to diagnose connectivity: seeding restores fixture prices and stock.
5. Set `BETTER_AUTH_URL` to the stable Production origin, such as `https://YOUR-PROJECT.vercel.app`, and open the app at that exact origin. In the Production GitHub OAuth App set its homepage to that origin and its authorization callback to `https://YOUR-PROJECT.vercel.app/api/auth/callback/github`. A per-deployment Vercel URL is a different origin and is not in this app's trusted origins. Confirm the matching `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and a stable `BETTER_AUTH_SECRET` of at least 32 characters are also set in Production, then redeploy.
6. Check `/api/products?sort=name`: `200` with `[]` means an empty catalogue; `500` means the data read failed. Then check `/api/products` to exercise the older ICU name sort too. A redirect to Vercel SSO is deployment protection, so use the intended Production domain and review its access settings before diagnosing an app response.

Prisma's [connection guide](https://www.prisma.io/docs/postgres/database/connecting-to-your-database) documents pooled versus direct TCP URLs. Better Auth's [options reference](https://better-auth.com/docs/reference/options) documents `baseURL` and trusted origins.

Use the selected deployment's build log for install/generate/compile problems and Vercel runtime logs for requests. Structured application logs contain a controlled operation name, an error category and a recognized driver/Prisma code. Database reads and the products API also rethrow the original error so Next.js/Vercel can log its message, stack and underlying cause. Failed products API requests now use the framework's HTTP 500 response instead of the previous JSON error body. Review runtime errors for sensitive details before sharing logs.

Examples: `database.pool`, `products.list`, `basket.mutate`, `order.checkout`, `auth.sign-out`, `auth.library`. For `ECONNREFUSED`/`ETIMEDOUT`, check provider readiness, endpoint, TLS, region and connection limits. For `PrismaClientValidationError`, verify schema/client generation and the deployed SHA before considering a database change.

Check active connections and plan limits in the database provider's dashboard; check invocation/concurrency usage in Vercel. Pool size is per process, so multiple function instances can exceed a database limit even though each process shares one client. Do not disable certificate validation as a connection fix.

Observed deployment problem: Vercel failed with `module-not-found` imports from the generated Prisma client in `lib/db/prisma.ts` and the repositories. The generated output exists locally but is ignored by Git. The fix is explicit generation in `npm run build`, rather than uploading the generated directory. The related earlier development error (`Unknown argument userId_requestKey`) was caused by an old client cached in the running dev process; regeneration plus restart corrected it. Complete the redeployment verification row in `ACCEPTANCE.md` after the fixed revision is online.

## Rollback

Record the previous working SHA/deployment before a release. Demonstrate rollback using a small UI-only change, without a database migration. Use Vercel's available rollback mechanism or manually redeploy the previous verified SHA using the Production configuration. Recheck catalogue, login and the same user's saved basket, then record which SHA the stable domain serves.

Application rollback does not undo migrations, database writes, environment changes or OAuth provider configuration. Check old-code compatibility with the current schema before selecting it. Additive changes are preferred. A destructive database change requires a verified backup and recovery procedure before deployment; backup/restore automation is outside this Lab 10 scope.

## References

- [Prisma ORM 7 on Vercel](https://www.prisma.io/docs/orm/v7/prisma-client/deployment/serverless/deploy-to-vercel)
- [Vercel Git integration and manual Git-reference deployments](https://vercel.com/docs/git)
- [Vercel Git deployment controls](https://vercel.com/docs/project-configuration/git-configuration)
- [Node.js versions on Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [node-postgres TLS configuration](https://node-postgres.com/features/ssl)
- [Better Auth session management](https://better-auth.com/docs/concepts/session-management)

The PDF requires this information in README for final submission. It is kept here because the user requested that README remain unchanged; reconcile the submission location with that requirement before hand-in.
