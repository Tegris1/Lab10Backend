import { describe, expect, it, vi } from "vitest";
import { deploymentIdentity, smokeCatalogue } from "../scripts/lib/release-verification.mjs";

const config = {
  deploymentURL: "https://deployment.example.test", token: "private-token",
  teamId: "team_fictional", projectId: "prj_fictional", sha: "a".repeat(40),
};
const deployment = {
  id: "dpl_fictional", projectId: config.projectId, target: "production", readyState: "READY",
  url: "deployment.example.test", meta: { githubCommitSha: config.sha },
  env: { SECRET: "must-not-appear-in-result" },
};
const products = () => Response.json([{ id: 1 }]);
const page = () => new Response('<ul aria-label="Products"></ul>', { headers: { "content-type": "text/html" } });

describe("published revision and catalogue smoke checks", () => {
  it("verifies Vercel project, Production target, readiness and SHA, returning only public evidence", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(deployment));
    const result = await deploymentIdentity(config, fetcher);
    expect(result).toEqual({ deploymentId: deployment.id, deploymentURL: config.deploymentURL, sha: config.sha });
    expect(JSON.stringify(result)).not.toContain("must-not-appear");
    expect(new URL(fetcher.mock.calls[0][0]).origin).toBe("https://api.vercel.com");
    expect(fetcher.mock.calls[0][1].redirect).toBe("error");
  });

  it.each([
    { meta: { githubCommitSha: "b".repeat(40) } }, { projectId: "prj_other" },
    { target: "preview" }, { readyState: "ERROR" }, { url: "other.example.test" },
  ])("refuses a different or failed deployment", async change => {
    await expect(deploymentIdentity(config, vi.fn().mockResolvedValue(Response.json({ ...deployment, ...change }))))
      .rejects.toThrow("does not match");
  });

  it("checks both the stable catalogue API and the rendered page", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(products()).mockResolvedValueOnce(page());
    expect(await smokeCatalogue("https://shop.example.test", { fetcher, attempts: 1 })).toMatchObject({ productCount: 1 });
    expect(fetcher.mock.calls.map(call => call[0])).toEqual([
      "https://shop.example.test/api/products?sort=name", "https://shop.example.test/product-list",
    ]);
  });

  it("retries provider wake-up errors", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(products()).mockResolvedValueOnce(page());
    expect(await smokeCatalogue("https://shop.example.test", { fetcher, attempts: 2, delayMs: 0 })).toMatchObject({ attempts: 2 });
  });

  it("rejects an empty database and a streamed error page", async () => {
    await expect(smokeCatalogue("https://shop.example.test", { attempts: 1, fetcher: vi.fn().mockResolvedValue(Response.json([])) }))
      .rejects.toThrow("nonempty product list");
    await expect(smokeCatalogue("https://shop.example.test", { attempts: 1,
      fetcher: vi.fn().mockResolvedValueOnce(products()).mockResolvedValueOnce(new Response("Error", { headers: { "content-type": "text/html" } })),
    })).rejects.toThrow("did not render");
  });

  it("sends the optional automation bypass as a header and refuses redirects", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(products()).mockResolvedValueOnce(page());
    await smokeCatalogue("https://shop.example.test", { fetcher, attempts: 1, bypassSecret: "private-bypass" });
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "error", headers: { "x-vercel-protection-bypass": "private-bypass" } });
    expect(fetcher.mock.calls[0][0]).not.toContain("private-bypass");
    const failure = vi.fn().mockRejectedValue(new Error("private-proxy-details"));
    await expect(smokeCatalogue("https://shop.example.test", { attempts: 1, fetcher: failure })).rejects.not.toThrow("private-proxy-details");
  });
});
