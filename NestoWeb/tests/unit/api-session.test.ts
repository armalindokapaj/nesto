import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";

// Phase 9 — four API routes authenticated with peekSession(), which reads the
// JWT and never touches the database. Two consequences it could not see: a
// stale role (Audit C2), and no accessMode check at all — so once Phase 18
// made suspension real, a revoked person kept working search and notifications
// for as long as their cookie lived.
const cookieState: { value: string | null } = { value: null };
vi.mock("@/lib/session", () => ({
  readSessionCookie: async () => (cookieState.value ? JSON.parse(cookieState.value) : null),
}));

const { getCurrentApiUser } = await import("@/lib/dal");

describe("getCurrentApiUser (Phase 9)", () => {
  let tenantId: string;
  let userId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    const tenant = await db.tenant.create({ data: { name: "API Session Test", slug: `apisession-${stamp}` } });
    tenantId = tenant.id;
    const u = await db.userIdentity.create({
      data: { email: `as-${stamp}@test.local`, username: `as${stamp}`, displayName: "AS User", passwordHash: "x" },
    });
    userId = u.id;
    await db.companyMembership.create({ data: { tenantId, userId, role: "ENGINEER" } });
  });

  afterAll(async () => {
    await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    await db.userIdentity.delete({ where: { id: userId } }).catch(() => {});
  });

  const signIn = (role: string) => {
    cookieState.value = JSON.stringify({ userId, tenantId, role });
  };

  it("returns null with no session rather than throwing", async () => {
    cookieState.value = null;
    // Returning null (not redirecting) is what lets the routes answer with a
    // clean 401 JSON; redirect() would hand a fetch() caller an HTML page, and
    // Next's docs forbid catching it inside try/catch to convert it.
    expect(await getCurrentApiUser()).toBeNull();
  });

  it("resolves the live membership for a valid session", async () => {
    signIn("ENGINEER");
    const s = await getCurrentApiUser();
    expect(s?.user.id).toBe(userId);
    expect(s?.role).toBe("ENGINEER");
  });

  it("uses the database role, not the role baked into the cookie", async () => {
    // The cookie still claims OWNER; the membership says ENGINEER.
    signIn("OWNER");
    const s = await getCurrentApiUser();
    expect(s?.role).toBe("ENGINEER");
  });

  it("refuses a suspended membership", async () => {
    signIn("ENGINEER");
    await db.companyMembership.update({ where: { tenantId_userId: { tenantId, userId } }, data: { accessMode: "SUSPENDED" } });
    expect(await getCurrentApiUser()).toBeNull();
  });

  it("refuses an archived membership", async () => {
    signIn("ENGINEER");
    await db.companyMembership.update({ where: { tenantId_userId: { tenantId, userId } }, data: { accessMode: "ARCHIVED" } });
    expect(await getCurrentApiUser()).toBeNull();
  });

  it("works again once access is restored", async () => {
    signIn("ENGINEER");
    await db.companyMembership.update({ where: { tenantId_userId: { tenantId, userId } }, data: { accessMode: "STANDARD" } });
    expect((await getCurrentApiUser())?.user.id).toBe(userId);
  });

  it("refuses a session whose membership no longer exists", async () => {
    cookieState.value = JSON.stringify({ userId, tenantId: "no-such-tenant", role: "OWNER" });
    expect(await getCurrentApiUser()).toBeNull();
  });
});
