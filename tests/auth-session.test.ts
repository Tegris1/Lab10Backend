import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationRequiredError, getCurrentSession, requireSession } from "@/lib/auth/session";

const { headers, getSession } = vi.hoisted(() => ({ headers: vi.fn(), getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));

beforeEach(() => { headers.mockResolvedValue(new Headers()); getSession.mockResolvedValue(null); });

describe("current request session", () => {
  it("validates each request's own headers instead of sharing a user between calls", async () => {
    const first = new Headers({ cookie: "first-request" });
    const second = new Headers({ cookie: "second-request" });
    headers.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    getSession.mockResolvedValueOnce({ user: { id: "user-a" } }).mockResolvedValueOnce({ user: { id: "user-b" } });
    expect((await getCurrentSession())?.user.id).toBe("user-a");
    expect((await getCurrentSession())?.user.id).toBe("user-b");
    expect(getSession).toHaveBeenNthCalledWith(1, { headers: first });
    expect(getSession).toHaveBeenNthCalledWith(2, { headers: second });
  });

  it("refuses access when validation rejects a present cookie", async () => {
    headers.mockResolvedValue(new Headers({ cookie: "forged-cookie" }));
    await expect(requireSession()).rejects.toBeInstanceOf(AuthenticationRequiredError);
  });

  it("returns the validated server identity and propagates verification failures", async () => {
    const validated = { user: { id: "server-user" } };
    getSession.mockResolvedValueOnce(validated);
    expect(await requireSession()).toBe(validated);
    getSession.mockRejectedValueOnce(new Error("Database unavailable"));
    await expect(getCurrentSession()).rejects.toThrow("Database unavailable");
  });
});
