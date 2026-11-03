import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { AUTH_BASE_PATH } from "@/lib/auth-paths";
import { logServerError } from "@/lib/logging";

export const runtime = "nodejs";
const handlers = toNextJsHandler(auth);
export const GET = handlers.GET;

function signOutUnavailable() {
  return Response.json({ code: "SIGN_OUT_UNAVAILABLE", message: "Could not sign out. Please try again." }, {
    status: 503, headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  const revokeAll = path === `${AUTH_BASE_PATH}/revoke-sessions`;
  if (path !== `${AUTH_BASE_PATH}/sign-out` && !revokeAll) return handlers.POST(request);
  try {
    const current = await auth.api.getSession({ headers: request.headers, query: { disableRefresh: true, disableCookieCache: true } });
    // Better Auth still performs its normal origin/CSRF checks and cookie handling.
    const response = await handlers.POST(request);
    if (!response.ok || !current) return response;
    // The pinned library catches deletion errors internally. Confirm invalidation before reporting success.
    const remaining = revokeAll
      ? await prisma.session.findFirst({ where: { userId: current.user.id, expiresAt: { gt: new Date() } }, select: { id: true } })
      : await prisma.session.findUnique({ where: { id: current.session.id }, select: { id: true } });
    if (remaining) return signOutUnavailable();
    if (revokeAll) {
      // revokeSessions removes the database sessions; signOut also expires this browser's cookies.
      // The original browser request has already passed Better Auth's origin/CSRF validation.
      const signOut = await auth.api.signOut({ headers: request.headers, body: { disableRedirect: true }, asResponse: true });
      if (!signOut.ok) return signOutUnavailable();
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("Cache-Control", "no-store");
      for (const cookie of signOut.headers.getSetCookie()) responseHeaders.append("Set-Cookie", cookie);
      return new Response(response.body, { status: response.status, headers: responseHeaders });
    }
    return response;
  } catch (error) {
    logServerError("auth.sign-out", error);
    return signOutUnavailable();
  }
}
