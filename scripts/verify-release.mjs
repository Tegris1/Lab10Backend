import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { deploymentIdentity, httpsOrigin, ReleaseVerificationError, smokeCatalogue } from "./lib/release-verification.mjs";

const directory = new URL("../.tools/release/", import.meta.url);
await mkdir(directory, { recursive: true });
const report = { status: "failed", checkedAt: new Date().toISOString() };
try {
  const deploymentURL = (await readFile(new URL("deployment-url.txt", directory), "utf8")).trim();
  const identity = await deploymentIdentity({
    deploymentURL, token: process.env.VERCEL_TOKEN,
    teamId: process.env.VERCEL_ORG_ID, projectId: process.env.VERCEL_PROJECT_ID,
    sha: process.env.GITHUB_SHA,
  });
  Object.assign(report, identity);
  const smoke = await smokeCatalogue(process.env.PRODUCTION_URL, {
    bypassSecret: process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  });
  Object.assign(report, { status: "passed", productionURL: smoke.origin, productCount: smoke.productCount });
  console.log(`Production release verified: ${identity.deploymentId}, SHA ${identity.sha}, ${smoke.productCount} products.`);
} catch (error) {
  // The report deliberately excludes raw Vercel responses, runtime errors and secrets.
  const reason = error instanceof ReleaseVerificationError ? error.message : "Could not read deployment evidence or contact Vercel.";
  Object.assign(report, { reason });
  console.error(`Release verification failed: ${reason}`);
  process.exitCode = 1;
} finally {
  await writeFile(new URL("result.json", directory), JSON.stringify(report, null, 2) + "\n");
  if (process.env.GITHUB_STEP_SUMMARY) {
    let origin = "unconfigured";
    try { origin = httpsOrigin(process.env.PRODUCTION_URL); } catch { /* Keep the summary useful for configuration failures too. */ }
    await appendFile(process.env.GITHUB_STEP_SUMMARY,
      `Production release: **${report.status}**\n\nOrigin: ${origin}\n\nSHA: ${report.sha ?? "unverified"}\n\nDeployment: ${report.deploymentId ?? "unverified"}\n`);
  }
}
