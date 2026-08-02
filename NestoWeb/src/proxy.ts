import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decryptSession, SESSION_COOKIE_NAME } from "@/lib/session";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (functionally identical).
// This only performs the *optimistic* check described in the Next.js auth
// guide — it reads the session cookie without hitting the database. The
// authoritative checks (role/permission, access-mode, tenant match) happen
// in the DAL (src/lib/dal.ts) on every Server Component / Route Handler.
const PUBLIC_ROUTES = ["/", "/apply", "/request-demo", "/security"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await decryptSession(token);
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  if (!isPublicRoute && !session) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/" && session) {
    return NextResponse.redirect(new URL("/dashboard/executive", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
