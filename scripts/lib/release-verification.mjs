import { setTimeout as delay } from "node:timers/promises";

// Only our own fixed diagnostic messages may be included in release reports.
export class ReleaseVerificationError extends Error {}

export function httpsOrigin(value) {
  let url;
  try { url = new URL(value ?? ""); }
  catch { throw new ReleaseVerificationError("Release URL must be an HTTPS origin."); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new ReleaseVerificationError("Release URL must be an HTTPS origin without credentials, path, query or fragment.");
  }
  return url.origin;
}

export async function deploymentIdentity(input, fetcher = fetch) {
  const origin = httpsOrigin(input.deploymentURL);
  if (!input.token || !input.teamId || !input.projectId || !/^[a-f0-9]{40}$/.test(input.sha ?? "")) {
    throw new ReleaseVerificationError("Deployment verification requires Vercel credentials, project/team IDs and the verified Git SHA.");
  }
  const url = new URL(`https://api.vercel.com/v13/deployments/${encodeURIComponent(new URL(origin).hostname)}`);
  url.searchParams.set("teamId", input.teamId);
  const response = await fetcher(url, {
    headers: { Authorization: `Bearer ${input.token}` },
    redirect: "error", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new ReleaseVerificationError(`Vercel deployment lookup failed (HTTP ${response.status}).`);
  const deployment = await response.json();
  if (deployment.projectId !== input.projectId || deployment.target !== "production" ||
      deployment.readyState !== "READY" || deployment.meta?.githubCommitSha !== input.sha ||
      !/^dpl_[a-zA-Z0-9]+$/.test(deployment.id ?? "") || deployment.url !== new URL(origin).hostname) {
    throw new ReleaseVerificationError("Vercel deployment does not match the verified SHA, configured project, URL or ready Production target.");
  }
  // Return only public evidence, never the full API response or deployment environment.
  return { deploymentId: deployment.id, deploymentURL: origin, sha: input.sha };
}

export async function smokeCatalogue(value, {
  fetcher = fetch, bypassSecret = "", attempts = 6, delayMs = 2000,
} = {}) {
  const origin = httpsOrigin(value);
  const headers = bypassSecret ? { "x-vercel-protection-bypass": bypassSecret } : {};
  let reason = "Request failed or timed out.";
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const options = () => ({ headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
      const api = await fetcher(`${origin}/api/products?sort=name`, options());
      if (!api.ok || !api.headers.get("content-type")?.includes("application/json")) {
        reason = `Catalogue API returned HTTP ${api.status} or an unexpected content type.`;
      } else {
        const products = await api.json();
        if (!Array.isArray(products) || products.length === 0 ||
            products.some(product => !Number.isInteger(product?.id) || product.id < 1)) {
          reason = "Catalogue API did not return a nonempty product list.";
        } else {
          const page = await fetcher(`${origin}/product-list`, options());
          if (page.ok && page.headers.get("content-type")?.includes("text/html") &&
              (await page.text()).includes('aria-label="Products"')) {
            return { origin, productCount: products.length, attempts: attempt + 1 };
          }
          reason = "The product-list page did not render the catalogue.";
        }
      }
    } catch {
      // A driver/proxy response or redirect must not leak into CI logs.
      reason = "Request failed, redirected, timed out or returned invalid JSON.";
    }
    if (attempt + 1 < attempts) await delay(delayMs);
  }
  throw new ReleaseVerificationError(`Production smoke check failed: ${reason}`);
}
