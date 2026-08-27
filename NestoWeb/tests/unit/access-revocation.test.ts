import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { setMemberAccessMode } from "@/server/admin";
import { terminateEmployment } from "@/server/hr";

// Phase 18 — Access Revocation. Before this, `accessMode` had exactly one
// writer in the whole app (the hardcoded "STANDARD" in actions/users.ts), so
// no membership could ever leave that state: dal.ts's SUSPENDED/ARCHIVED
// check and the `{ not: "SUSPENDED" }` filters were unreachable branches, and
// terminating an employee left their login fully working.
describe("membership access revocation", () => {
  let tenantId: string;
  let owner: { id: string };
  let secondOwner: { id: string };
  let admin: { id: string };
  let member: { id: string };

  const mkUser = async (label: string) => {
    const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    return db.userIdentity.create({
      data: {
        email: `rev-${label}-${stamp}@test.local`,
        username: `rev${label}${stamp}`,
        displayName: `Rev ${label}`,
        passwordHash: "x",
      },
    });
  };

  beforeAll(async () => {
    const tenant = await db.tenant.create({
      data: { name: "Revocation Test Tenant", slug: `revocation-test-${Date.now()}` },
    });
    tenantId = tenant.id;

    [owner, secondOwner, admin, member] = await Promise.all([
      mkUser("owner"),
      mkUser("owner2"),
      mkUser("admin"),
      mkUser("member"),
    ]);

    await db.companyMembership.createMany({
      data: [
        { tenantId, userId: owner.id, role: "OWNER" },
        { tenantId, userId: secondOwner.id, role: "OWNER" },
        { tenantId, userId: admin.id, role: "ADMIN" },
        { tenantId, userId: member.id, role: "ENGINEER" },
      ],
    });
  });

  afterAll(async () => {
    await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    await db.userIdentity
      .deleteMany({ where: { id: { in: [owner.id, secondOwner.id, admin.id, member.id] } } })
      .catch(() => {});
  });

  const modeOf = async (userId: string) =>
    (await db.companyMembership.findUnique({ where: { tenantId_userId: { tenantId, userId } } }))?.accessMode;

  it("suspends a member, and dal.ts's blocking condition now actually matches", async () => {
    await setMemberAccessMode(tenantId, { id: admin.id, role: "ADMIN" }, member.id, "SUSPENDED", "left the site");
    expect(await modeOf(member.id)).toBe("SUSPENDED");
  });

  it("writes an audit event naming who did it, the transition and the reason", async () => {
    const event = await db.auditEvent.findFirst({
      where: { tenantId, action: "MEMBER_ACCESS_REVOKED" },
      orderBy: { createdAt: "desc" },
    });
    expect(event?.actorId).toBe(admin.id);
    const meta = JSON.parse(event?.metadata ?? "{}");
    expect(meta).toMatchObject({ from: "STANDARD", to: "SUSPENDED", reason: "left the site" });
  });

  it("restores a suspended member", async () => {
    await setMemberAccessMode(tenantId, { id: admin.id, role: "ADMIN" }, member.id, "STANDARD");
    expect(await modeOf(member.id)).toBe("STANDARD");
  });

  it("refuses to let an actor revoke their own access", async () => {
    await expect(
      setMemberAccessMode(tenantId, { id: admin.id, role: "ADMIN" }, admin.id, "SUSPENDED"),
    ).rejects.toThrow(/your own access/i);
    expect(await modeOf(admin.id)).toBe("STANDARD");
  });

  // Audit C3's boundary: Admin carries the same permission matrix as Owner,
  // so without this an Admin could suspend the Owner and take the tenant.
  it("refuses to let an Admin revoke an Owner", async () => {
    await expect(
      setMemberAccessMode(tenantId, { id: admin.id, role: "ADMIN" }, owner.id, "SUSPENDED"),
    ).rejects.toThrow(/Only the Company Owner/i);
    expect(await modeOf(owner.id)).toBe("STANDARD");
  });

  it("lets an Owner revoke another Owner while a second one is still active", async () => {
    await setMemberAccessMode(tenantId, { id: owner.id, role: "OWNER" }, secondOwner.id, "SUSPENDED");
    expect(await modeOf(secondOwner.id)).toBe("SUSPENDED");
  });

  it("refuses to revoke the last active Owner, which would orphan the tenant", async () => {
    // secondOwner is suspended by the test above, so `owner` is now the only
    // active one — and nobody, Owner included, may remove the last way in.
    await expect(
      setMemberAccessMode(tenantId, { id: secondOwner.id, role: "OWNER" }, owner.id, "ARCHIVED"),
    ).rejects.toThrow(/last active Owner/i);
    expect(await modeOf(owner.id)).toBe("STANDARD");
  });

  it("rejects a mode outside the assignable set", async () => {
    await expect(
      // VIEW_ONLY is a real schema value but is not assignable while
      // permissions.canWrite() has no callers to enforce it.
      setMemberAccessMode(tenantId, { id: admin.id, role: "ADMIN" }, member.id, "VIEW_ONLY" as never),
    ).rejects.toThrow(/Unknown access mode/i);
  });

  describe("employment termination cascade", () => {
    const seedEmployment = async (userId: string, name: string) => {
      const employee = await db.employee.create({
        data: { tenantId, userId, fullName: name, position: "Engineer", department: "ENGINEERING", hireDate: new Date("2024-01-01") },
      });
      return db.employmentRelationship.create({
        data: {
          tenantId,
          employeeId: employee.id,
          jobTitle: "Engineer",
          department: "ENGINEERING",
          effectiveStartDate: new Date("2024-01-01"),
          status: "ACTIVE",
          createdById: admin.id,
        },
      });
    };

    it("archives the linked login when the termination is effective today", async () => {
      const employment = await seedEmployment(member.id, "Rev member");
      await terminateEmployment(tenantId, admin.id, employment.id, new Date());
      expect(await modeOf(member.id)).toBe("ARCHIVED");
    });

    it("leaves access alone for a future-dated termination, and says so on the record", async () => {
      const leaver = await mkUser("future");
      await db.companyMembership.create({ data: { tenantId, userId: leaver.id, role: "ENGINEER" } });
      const employment = await seedEmployment(leaver.id, "Rev future");

      const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await terminateEmployment(tenantId, admin.id, employment.id, nextMonth);

      // Access must survive until the person's actual last day.
      expect(await modeOf(leaver.id)).toBe("STANDARD");

      const activity = await db.hrActivity.findFirst({
        where: { tenantId, entityId: employment.id, eventType: "TERMINATED" },
        orderBy: { createdAt: "desc" },
      });
      // There is no scheduler to revoke it on the day, so the record has to
      // say that out loud rather than let it look handled.
      expect(activity?.summary).toMatch(/suspend manually/i);
    });
  });
});
