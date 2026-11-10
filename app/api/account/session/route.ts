import { auth } from "@/lib/auth";

export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(request: Request) {
  try {
    const { response: session, headers } = await auth.api.getSession({
      headers: request.headers, query: { disableCookieCache: true }, returnHeaders: true,
    });
    const response = Response.json({
      user: session ? { id: session.user.id, name: session.user.name, email: session.user.email } : null,
    }, { headers: privateHeaders });
    for (const cookie of headers.getSetCookie()) response.headers.append("Set-Cookie", cookie);
    return response;  
  } catch {
    return Response.json({ message: "Could not verify your session." }, { status: 503, headers: privateHeaders });
  }//testststsdf
}
