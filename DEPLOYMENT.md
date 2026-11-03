# Lab 10 deployment runbook

This runbook covers the basic deployment requirements in sections 1–9. The final Lab 10 extensions are excluded. README is intentionally unchanged.

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
| Release method | Operator-triggered deployment of the verified `main` SHA |
| Stable HTTPS address | Pending Vercel setup; record the actual value in `ACCEPTANCE.md` |

The project retains Next.js 16.3.8 and Prisma/client/adapter 7.10.1. `package-lock.json` pins installations. `@vercel/functions` 3.10.6 manages idle connections on Vercel.

Vercel Hobby does not deploy private GitHub organization repositories. If that affects the course repository, use an allowed private personal repository preserving its history and keep the course repository/PR as required by the lecturer. Do not make course material public to bypass this restriction.

## Environment variables

Store actual values in Vercel's **Production** environment and in protected local operator environments. `.env.example` contains placeholders only. A changed Vercel variable requires a new deployment.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Runtime-role PostgreSQL URL, normally the provider's pooled endpoint; remote URLs require `sslmode=verify-full` |
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

`.github/workflows/ci.yml` runs on `main`/`lab10` pushes, PRs to `main`, and manual dispatch. It uses Node.js 24, a PostgreSQL 17 service and only fictional credentials. It generates the client once, runs lint, real unit tests, integration checks on uniquely named temporary databases, then builds. The integration role can create/drop those databases only in the disposable service.

To repeat the checks in a clean checkout, use local `.env` values and a separate `TEST_DATABASE_URL` as described in `.env.example`:

```powershell
npm ci --include=dev
npm run ci:check
```

Tests were not run locally during this implementation at the user's request. CI results must be obtained before declaring a release accepted. Existing browser scripts from earlier labs include legacy demo-history assumptions; they are not part of this CI job and must not be cited as current deployment evidence.

Local implementation verification completed: the working-copy lint/build passed, and a separate source snapshot installed with `npm ci --include=dev`, passed lint, and built after clearing generated Prisma output and build artifacts. That snapshot used fictional environment values and no real `.env` or database connection. Vercel/GitHub Actions execution and Production acceptance remain pending.

## Publish a specific revision

1. Commit/push the reviewed `lab10` changes and open the required PR to `main` when authorized. No commits or PRs are created automatically by these scripts.
2. After merge, wait for successful checks on the **resulting `main` SHA**, not only the PR's temporary merge revision. Record the SHA and CI run link.
3. Use that same checkout to run the migration/status/schema verification steps with the migration role. Apply runtime grants if needed. Do not reseed on normal releases: the seed restores catalogue prices and stock from JSON.
4. In Vercel set the Production branch to `main`, Node.js to 24.x, the framework to Next.js, and the Production variables listed above. `vercel.json` supplies the install/build commands and region.
5. `git.deploymentEnabled: false` disables Git-triggered publishing for all branches, including Preview. After the checks and database steps, use Vercel Dashboard **Deployments → Create Deployment** and supply the verified `main` SHA. Select the Production/main configuration. No automated CI/CD extension is claimed.
6. Inspect the build log: client generation must precede Next.js compilation. Confirm the resulting commit SHA, Production environment and stable domain. Run the acceptance checklist at that domain and record results.

If the initial Vercel setup is already deploying older code, stop relying on that deployment's result. The code here must be committed/pushed and deployed at its own verified revision. Green GitHub Actions alone cannot stop a separate Vercel release; the manual release policy is intentional.

## Diagnostics

Use the selected deployment's build log for install/generate/compile problems and Vercel runtime logs for requests. Application logs contain a controlled operation name, an error category and a recognized driver/Prisma code. They exclude raw errors, query values, connection URLs, cookies and OAuth tokens. Client errors remain generic.

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
