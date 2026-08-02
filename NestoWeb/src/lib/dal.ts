import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { readSessionCookie } from "@/lib/session";
import { db } from "@/lib/db";

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
    role: session.role,
    company: membership.tenant.companies[0] ?? null,
  };
});

export type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;
