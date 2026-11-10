# Lab 10 production acceptance record

Status: **not yet accepted**. This is a record to complete against the stable Production domain, not evidence that deployment or tests have passed.

| Release field | Actual value |
| --- | --- |
| Stable HTTPS URL | Pending Vercel setup |
| Final deployed `main` commit SHA | Pending |
| Previous working SHA / deployment | Pending |
| PR `lab10` → `main` | Pending |
| CI run for final `main` SHA | Pending |
| Vercel deployment identifier / build result | Pending |
| Application region | Configured `fra1`; confirm in Vercel |
| Database provider, PostgreSQL version and region | Pending |
| Migration-role verification date/result | Pending |
| Runtime-role verification date/result | Pending |
| Acceptance operator and UTC time | Pending |

Record non-sensitive screenshots, request outcomes and database observations. Never paste tokens, cookie values, passwords, full connection URLs or another user's personal data into this document.

| Scenario | Procedure and expected result | Result / UTC time / evidence |
| --- | --- | --- |
| Public catalogue | Signed out: catalogue has 100 seeded products; category/stock/sort filters, local images and product details work. Prices are formatted from integer grosze. | Pending |
| Missing product and URL | Open a nonexistent product ID and an unknown path. Show the application's not-found view and a return link. | Pending |
| OAuth | A clean browser profile signs in through the separate Production GitHub OAuth App and returns to the stable HTTPS domain. Refresh preserves the session. | Pending |
| New user | First sign-in shows an empty basket and total zero without requiring a pre-created cart. | Pending |
| Basket operations | Add a product twice, update quantity, remove it. The database has no duplicate cart/product pair; totals use server-side current prices. | Pending |
| Invalid writes | Zero, negative, fractional, greater-than-99 and greater-than-stock quantities fail without modifying basket data. A forged/missing/expired session cannot mutate it. | Pending |
| Account isolation | Two real GitHub accounts use separate profiles. Capture an actual basket action and substitute the other account's item ID; access is denied and its database row remains unchanged. Do not exchange account credentials or publish session tokens. | Pending |
| Logout and return | Save a basket, sign out, and replay the saved request using the ended session: no write. Sign in again: the same user's basket is restored. | Pending |
| Existing order history | Place an order using the implemented checkout. It appears only in the owner's history with saved names/codes/prices; an unrelated account cannot open its details. | Pending |
| New deployment | Record a basket's product IDs/quantities and catalogue row count, publish a minor UI change at a new verified SHA, and confirm catalogue/login/writes still work and the saved basket remains intact. Do not seed during redeployment. | Pending |
| Runtime errors | Inspect function logs and protected operation responses. User-visible errors and saved evidence contain no SQL, credentials, cookies or OAuth tokens. | Pending |
| Deployment fix | Redeploy the revision with explicit Prisma generation. Build passes the earlier missing-generated-client step and catalogue/basket/history load at the stable domain. | Pending |
| Rollback | Restore the previous working UI-only revision. Confirm stable-domain SHA, catalogue, login and the saved basket; database remains unchanged by rollback. | Pending |

The two-account acceptance scenario needs a second real GitHub account, which can belong to a collaborating student using their own profile. A fictional local order owner helps check ownership locally but does not replace this production OAuth scenario.

## Lab 10 extension: basket browser test

Implementation: `npm run test:e2e:cart`, backed by `scripts/run-cart-e2e.mjs` and `scripts/verify-basket-ui.ts`. The workflow runs it after the production build on its local PostgreSQL service and uploads `.tools/cart-e2e/` results for seven days. No Production database or real OAuth account is used.

| Check | Local result | GitHub Actions evidence |
| --- | --- | --- |
| Add, change quantity, remove, empty basket and correct totals | Passed with headless Edge and disposable PostgreSQL 17 | Pending workflow run |
| Add/update/remove without a session or with a forged cookie | All six replays refused; baskets/items/stock unchanged | Pending workflow run |
| Detect authorization regression | Temporary local compiled-artifact mutation failed the expected assertion; original artifact restored | Local controlled experiment only |
| Cleanup after success and failure | Test server/browser stopped and only the generated database removed | Pending workflow run |
| Supporting checks | 157 unit tests, 43 integration tests, lint and production build passed | Pending workflow run |

Local evidence: `.tools/cart-e2e/result.json`, desktop/mobile screenshots and the separately retained controlled-regression report. These ignored files are local verification artifacts; they do not establish Production acceptance. See `DEPLOYMENT.md` for setup, test scope and maintenance cost.

## Lab 10 extension: automatic CI/CD

Implementation: `verify` → `deploy` in `.github/workflows/ci.yml`. Production publication runs only after successful verification of a `main` push. Manual dispatches are secret-free publication-gate rehearsals and never migrate or deploy. Git-triggered Vercel publishing stays disabled.

| Check | Local evidence | Hosted acceptance |
| --- | --- | --- |
| Release origin/direct connection preflight, deployment SHA/project/readiness and catalogue smoke checks | Automated unit tests passed | Pending Production configuration and release |
| Workflow validity | `actionlint` and TypeScript passed | Pending GitHub run |
| Deliberate failed-test fixture | `npm run test:ci-gate:failure` exits 1 as intended | Record manual `fail_test: true` run with `deploy` skipped |
| Positive gate rehearsal | Fixture excluded from the passing normal suite | Record manual `fail_test: false` run with a successful rehearsal job |
| Production unchanged during both rehearsals | No remote publication performed locally | Record active deployment IDs before/after |
| Actual verified-SHA release | CLI flags checked without authentication | Record successful main-push run, deployment ID/SHA, stable URL and smoke result |

Setup and precise rehearsal instructions are in `DEPLOYMENT.md`. Production acceptance is still pending; the workflow files alone are not evidence of a successful release or skipped hosted publication.

Remaining Lab 10 extensions: a separately deployed test environment, backup/restore demonstration, and performance measurements. The temporary CI database and secret-free gate rehearsal are test isolation, not a deployed staging environment.
