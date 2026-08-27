import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { canViewCompensation, canViewSalary, getSalaryHistory } from "@/server/employee-profile";
import { grantCapability, revokeCapability, hasCapability } from "@/server/capabilities";

// Phase 1 Tracks B and C.
describe("audit coverage and the compensation capability", () => {
  let tenantId: string;
  let hrUser: string;
  let engineer: string;
  let employeeId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    const tenant = await db.tenant.create({ data: { name: "Audit Cap Test", slug: `auditcap-${stamp}` } });
    tenantId = tenant.id;
    const mk = async (label: string, role: string) => {
      const u = await db.userIdentity.create({
        data: { email: `ac-${label}-${stamp}@test.local`, username: `ac${label}${stamp}`, displayName: `AC ${label}`, passwordHash: "x" },
      });
      await db.companyMembership.create({ data: { tenantId, userId: u.id, role } });
      return u.id;
    };
    hrUser = await mk("hr", "HR");
    engineer = await mk("eng", "ENGINEER");
    const employee = await db.employee.create({
      data: { tenantId, fullName: "AC Employee", position: "Engineer", department: "ENGINEERING", hireDate: new Date("2024-01-01") },
    });
    employeeId = employee.id;
  });

  afterAll(async () => {
    await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    await db.userIdentity.deleteMany({ where: { id: { in: [hrUser, engineer] } } }).catch(() => {});
  });

  describe("logAudit helper (Track B)", () => {
    it("writes a queryable row with serialized metadata", async () => {
      await logAudit({
        tenantId, actorId: hrUser, action: "payroll.run.locked",
        targetType: "PayrollRun", targetId: "run-1", metadata: { lines: 12 },
      });
      const row = await db.auditEvent.findFirstOrThrow({ where: { tenantId, action: "payroll.run.locked" } });
      expect(row.actorId).toBe(hrUser);
      expect(JSON.parse(row.metadata ?? "{}")).toEqual({ lines: 12 });
    });

    it("rolls back with the write it describes when passed a transaction", async () => {
      await expect(
        db.$transaction(async (tx) => {
          await logAudit({ tenantId, actorId: hrUser, action: "should.not.persist", targetType: "X", targetId: "y" }, tx);
          throw new Error("boom");
        })
      ).rejects.toThrow("boom");
      // An audit trail that survives a failed write is worse than none.
      expect(await db.auditEvent.count({ where: { tenantId, action: "should.not.persist" } })).toBe(0);
    });
  });

  describe("hr.compensation.view (Track C)", () => {
    const viewer = () => ({ userId: hrUser, role: "HR" as const });

    it("lets an HR user see compensation by default", async () => {
      expect(canViewSalary(viewer())).toBe(true);
      expect(await canViewCompensation(tenantId, viewer())).toBe(true);
    });

    // The capability existed, hasCapability() was correct, and nothing that
    // reads compensation ever called it — so this revoke used to do nothing.
    it("actually hides compensation once the capability is revoked", async () => {
      await revokeCapability(tenantId, hrUser, hrUser, "hr.compensation.view");
      expect(await hasCapability(tenantId, hrUser, "HR", "hr.compensation.view")).toBe(false);
      expect(await canViewCompensation(tenantId, viewer())).toBe(false);
      // The role check is untouched — the capability can only take access away.
      expect(canViewSalary(viewer())).toBe(true);
      await expect(getSalaryHistory(tenantId, employeeId, viewer())).rejects.toThrow(/permission/i);
    });

    it("restores access when the capability is granted back", async () => {
      await grantCapability(tenantId, hrUser, hrUser, "hr.compensation.view");
      expect(await canViewCompensation(tenantId, viewer())).toBe(true);
      await expect(getSalaryHistory(tenantId, employeeId, viewer())).resolves.toBeDefined();
    });

    it("never grants access the role check alone would refuse", async () => {
      // Granting the capability to an ENGINEER must not open compensation:
      // the two checks are ANDed, so the capability cannot widen access.
      await grantCapability(tenantId, hrUser, engineer, "hr.compensation.view");
      expect(await hasCapability(tenantId, engineer, "ENGINEER", "hr.compensation.view")).toBe(true);
      expect(await canViewCompensation(tenantId, { userId: engineer, role: "ENGINEER" })).toBe(false);
    });
  });
});
