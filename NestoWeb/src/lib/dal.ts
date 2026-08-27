import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { readSessionCookie } from "@/lib/session";
import { db } from "@/lib/db";
import type { Role } from "@/lib/constants";

// Data Access Layer — every Server Component / Server Action / Route Handler
// that touches tenant data should go through verifySession()/getCurrentUser()
// rather than reading the cookie directly (Next.js auth guide's recommended
// pattern). Memoized per-request via React's cache().

export const verifySession = cache(async () => {
  const session = await readSessionCookie();
  if (!session?.userId) {
    redirect("/");
  }
  return session;
});

// Optimistic-only variant — never redirects. Use in places (e.g. the landing
// page) that need to know "is someone logged in" without forcing a redirect.
export const peekSession = cache(async () => {
  return readSessionCookie();
});

// Phase 9 — the Route Handler counterpart to getCurrentUser().
//
// Four API routes authenticated with peekSession(), which decrypts the cookie
// and performs no database read at all — precisely what its own doc comment
// says not to do with real data. Two consequences: the JWT's `role` is a
// 7-day-stale snapshot (Audit C2, the thing getCurrentUser() exists to fix),
// and nothing checked `accessMode`, so once Phase 18 made suspension possible,
// a revoked person kept working notifications and search for up to a week.
//
// A separate function rather than reusing getCurrentUser() because that one
// calls redirect(), which sends a fetch() caller an HTML page where it expects
// JSON. Next's docs also require redirect() to be called outside try/catch —
// it works by throwing NEXT_REDIRECT — so catching it to convert to a 401 would
// silently break the redirect. Returning null instead lets the route answer
// with a clean 401 and keeps the same live membership checks.
export const getCurrentApiUser = cache(async () => {
  const session = await readSessionCookie();
  if (!session?.userId) return null;

  const [user, membership] = await Promise.all([
    db.userIdentity.findUnique({ where: { id: session.userId } }),
    db.companyMembership.findUnique({
      where: { tenantId_userId: { tenantId: session.tenantId, userId: session.userId } },
    }),
  ]);

  if (!user || !membership) return null;
  if (membership.accessMode === "SUSPENDED" || membership.accessMode === "ARCHIVED") return null;

  return {
    user,
    membership,
    tenantId: session.tenantId,
    // Live, not the cookie's snapshot — a demotion takes effect immediately.
    role: membership.role as Role,
  };
});

export const getCurrentUser = cache(async () => {
  const session = await verifySession();
  const [user, membership] = await Promise.all([
    db.userIdentity.findUnique({ where: { id: session.userId } }),
    db.companyMembership.findUnique({
      where: { tenantId_userId: { tenantId: session.tenantId, userId: session.userId } },
      include: { tenant: { include: { companies: true } } },
    }),
  ]);

  if (!user || !membership || membership.accessMode === "SUSPENDED" || membership.accessMode === "ARCHIVED") {
    // Signature-valid cookie, but the userId/tenantId it references is gone
    // or blocked — redirecting straight to "/" would loop forever, since
    // proxy.ts's optimistic check would still see a "valid" cookie and
    // bounce back to a protected route. Route through the invalidate
    // handler so the stale cookie actually gets cleared first.
    redirect("/api/auth/invalidate");
  }

  return {
    user,
    membership,
    tenantId: session.tenantId,
    // Audit C2 — the JWT's `role` is a 7-day-stale snapshot from login time.
    // The authoritative role is whatever CompanyMembership says *right now*,
    // so a demotion/promotion takes effect on the very next request instead
    // of waiting for the cookie to expire.
    role: membership.role as Role,
    company: membership.tenant.companies[0] ?? null,
  };
});

export type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;
