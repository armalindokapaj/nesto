import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { decideProjectApproval, createProjectApproval } from "@/server/project-approvals";
import { decideLeaveRequest, cancelApprovedLeave, createLeaveRequest } from "@/server/hr";
import { createPayrollRun, calculatePayrollRun } from "@/server/payroll";
import { transferAsset } from "@/server/assets-module";

// Phases 10, 11, 12 and 20 — one shared shape: a function that changes state
// without first checking the state it is changing. In every case a correct
// sibling already existed nearby; these tests pin the corrected behaviour.
describe("decision and state guards", () => {
  let tenantId: string;
  let companyId: string;
  let projectId: string;
  let requester: string;
  let approver: string;
  let employeeId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    const tenant = await db.tenant.create({ data: { name: "Guards Test", slug: `guards-${stamp}` } });
    tenantId = tenant.id;
    const company = await db.company.create({ data: { tenantId, name: "GT Co", isParent: true } });
    companyId = company.id;
    const project = await db.project.create({ data: { tenantId, companyId, code: "GT-1", name: "Guard Tower", status: "ON_TRACK" } });
    projectId = project.id;

    const mk = async (label: string, role: string) => {
      const u = await db.userIdentity.create({
        data: { email: `gt-${label}-${stamp}@test.local`, username: `gt${label}${stamp}`, displayName: `GT ${label}`, passwordHash: "x" },
      });
      await db.companyMembership.create({ data: { tenantId, userId: u.id, role } });
      return u.id;
    };
    requester = await mk("req", "PM");
    approver = await mk("app", "OWNER");

    const employee = await db.employee.create({
      data: { tenantId, fullName: "GT Employee", position: "Engineer", department: "ENGINEERING", hireDate: new Date("2024-01-01") },
    });
    employeeId = employee.id;
  });

  afterAll(async () => {
    await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    await db.userIdentity.deleteMany({ where: { id: { in: [requester, approver] } } }).catch(() => {});
  });

  // --- Phase 11 -------------------------------------------------------------
  describe("project approvals (Phase 11)", () => {
    const newApproval = () =>
      createProjectApproval(tenantId, { projectId, requesterId: requester, title: "Add a basement level", approverId: approver });

    it("decides a pending request and writes an audit event", async () => {
      const a = await newApproval();
      const decided = await decideProjectApproval(tenantId, a.id, approver, "APPROVED", "Budget confirmed");
      expect(decided.status).toBe("APPROVED");
      const event = await db.auditEvent.findFirst({ where: { tenantId, targetId: a.id, action: "PROJECT_APPROVAL_APPROVED" } });
      // ProjectApproval wrote no AuditEvent anywhere before this phase.
      expect(event?.actorId).toBe(approver);
    });

    it("refuses to re-decide an already-decided request", async () => {
      const a = await newApproval();
      await decideProjectApproval(tenantId, a.id, approver, "APPROVED");
      // Previously this silently overwrote status, decidedAt and decisionNote.
      await expect(decideProjectApproval(tenantId, a.id, approver, "REJECTED")).rejects.toThrow(/already been decided/i);
      const after = await db.projectApproval.findUniqueOrThrow({ where: { id: a.id } });
      expect(after.status).toBe("APPROVED");
    });

    it("refuses to let the requester decide their own request", async () => {
      const a = await createProjectApproval(tenantId, {
        projectId, requesterId: requester, title: "Self-approve attempt", approverId: requester,
      });
      await expect(decideProjectApproval(tenantId, a.id, requester, "APPROVED")).rejects.toThrow(/submitted yourself/i);
    });

    it("still refuses anyone who is not the assigned approver", async () => {
      const a = await newApproval();
      await expect(decideProjectApproval(tenantId, a.id, requester, "APPROVED")).rejects.toThrow(/assigned approver/i);
    });
  });

  // --- Phase 12 -------------------------------------------------------------
  describe("leave requests (Phase 12)", () => {
    const newLeave = () =>
      createLeaveRequest(tenantId, employeeId, requester, { startDate: new Date("2026-09-01"), endDate: new Date("2026-09-05") });

    it("decides a pending leave request", async () => {
      const l = await newLeave();
      const decided = await decideLeaveRequest(tenantId, approver, l.id, "APPROVED");
      expect(decided.status).toBe("APPROVED");
    });

    // cancelApprovedLeave() nine lines below always had this guard, and the
    // comment above it claimed both functions did.
    it("refuses to flip an approved leave request to rejected", async () => {
      const l = await newLeave();
      await decideLeaveRequest(tenantId, approver, l.id, "APPROVED");
      await expect(decideLeaveRequest(tenantId, approver, l.id, "REJECTED")).rejects.toThrow(/already been decided/i);
      const after = await db.leaveRequest.findUniqueOrThrow({ where: { id: l.id } });
      expect(after.status).toBe("APPROVED");
    });

    it("leaves the cancel path working as before", async () => {
      const l = await newLeave();
      await decideLeaveRequest(tenantId, approver, l.id, "APPROVED");
      const cancelled = await cancelApprovedLeave(tenantId, approver, l.id);
      expect(cancelled.status).toBe("CANCELLED");
    });
  });

  // --- Phase 10 -------------------------------------------------------------
  describe("payroll runs (Phase 10)", () => {
    let groupId: string;
    const period = { periodStart: new Date("2026-09-01"), periodEnd: new Date("2026-09-30"), payDate: new Date("2026-10-05") };

    beforeAll(async () => {
      const g = await db.payrollGroup.create({ data: { tenantId, companyId, name: "GT Monthly" } });
      groupId = g.id;
    });

    it("creates the first run for a period", async () => {
      const run = await createPayrollRun(tenantId, approver, { payrollGroupId: groupId, ...period });
      expect(run.status).toBe("DRAFT");
    });

    // Two DRAFT runs for one period means two sets of PayrollRunLine rows and
    // people paid twice — the one place in this sweep where the bad outcome is
    // duplicate salary, not a display glitch.
    it("refuses a second run for the same group and period", async () => {
      await expect(createPayrollRun(tenantId, approver, { payrollGroupId: groupId, ...period })).rejects.toThrow(/already exists/i);
    });

    // The partial unique index is what actually holds here: the pre-check and
    // the insert are separate statements, so a double-click passes both.
    it("lets only one of two simultaneous creates win", async () => {
      const p2 = { periodStart: new Date("2026-11-01"), periodEnd: new Date("2026-11-30"), payDate: new Date("2026-12-05") };
      const results = await Promise.allSettled([
        createPayrollRun(tenantId, approver, { payrollGroupId: groupId, ...p2 }),
        createPayrollRun(tenantId, approver, { payrollGroupId: groupId, ...p2 }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const count = await db.payrollRun.count({
        where: { tenantId, payrollGroupId: groupId, periodStart: p2.periodStart, status: { not: "CANCELLED" } },
      });
      expect(count).toBe(1);
    });

    // Phase 2 Track B — calculatePayrollRun() ran one findFirst plus one create
    // per employee, sequentially, inside the transaction.
    it("calculates every employee's line without a query per employee", async () => {
      const p4 = { periodStart: new Date("2027-02-01"), periodEnd: new Date("2027-02-28"), payDate: new Date("2027-03-05") };
      const run = await createPayrollRun(tenantId, approver, { payrollGroupId: groupId, ...p4 });

      const staff: string[] = [];
      for (let i = 0; i < 5; i++) {
        const e = await db.employee.create({
          data: { tenantId, fullName: `Payroll Staff ${i}`, position: "Fitter", department: "ENGINEERING", hireDate: new Date("2024-01-01"), status: "ACTIVE" },
        });
        await db.salaryRecord.create({
          data: { tenantId, employeeId: e.id, status: "CURRENT", grossSalary: 1000 + i, netSalary: 800 + i, currency: "EUR", effectiveStartDate: new Date("2025-01-01"), createdById: approver },
        });
        staff.push(e.id);
      }

      const calculated = await calculatePayrollRun(tenantId, approver, run.id);
      expect(calculated.status).toBe("CALCULATED");
      const lines = await db.payrollRunLine.findMany({ where: { tenantId, payrollRunId: run.id } });
      expect(lines.length).toBeGreaterThanOrEqual(5);
      // Each line still carries the right figures, not just the right count.
      const mine = lines.filter((l) => staff.includes(l.employeeId));
      expect(mine).toHaveLength(5);
      expect(mine.every((l) => l.grossSalaryMinor >= 100_000 && l.calculationTrace?.includes("SalaryRecord"))).toBe(true);
    });

    it("skips an employee with no compensation on file rather than inventing a figure", async () => {
      const p5 = { periodStart: new Date("2027-03-01"), periodEnd: new Date("2027-03-31"), payDate: new Date("2027-04-05") };
      const run = await createPayrollRun(tenantId, approver, { payrollGroupId: groupId, ...p5 });
      const unpaid = await db.employee.create({
        data: { tenantId, fullName: "No Salary On File", position: "Intern", department: "ENGINEERING", hireDate: new Date("2025-06-01"), status: "ACTIVE" },
      });
      await calculatePayrollRun(tenantId, approver, run.id);
      const lines = await db.payrollRunLine.findMany({ where: { tenantId, payrollRunId: run.id } });
      expect(lines.some((l) => l.employeeId === unpaid.id)).toBe(false);
    });

    it("allows a fresh run for a period whose previous run was cancelled", async () => {
      const p3 = { periodStart: new Date("2026-12-01"), periodEnd: new Date("2026-12-31"), payDate: new Date("2027-01-05") };
      const first = await createPayrollRun(tenantId, approver, { payrollGroupId: groupId, ...p3 });
      await db.payrollRun.update({ where: { id: first.id }, data: { status: "CANCELLED" } });
      // A plain @@unique would have blocked this permanently, which is why the
      // index is partial on status.
      const second = await createPayrollRun(tenantId, approver, { payrollGroupId: groupId, ...p3 });
      expect(second.id).not.toBe(first.id);
    });
  });

  // --- Phase 20 -------------------------------------------------------------
  describe("asset transfers (Phase 20)", () => {
    const newAsset = () =>
      db.asset.create({ data: { tenantId, name: "Tower Crane", type: "EQUIPMENT", status: "ACTIVE", ownershipCompanyName: "GT Co" } });

    it("moves the asset itself, not just the transfer log", async () => {
      const asset = await newAsset();
      await transferAsset(tenantId, approver, asset.id, {
        fromType: "COMPANY", fromName: "GT Co", toType: "PROJECT", toId: projectId, toName: "Guard Tower",
        transferredAt: new Date(), reason: "Mobilising to site",
      });
      const after = await db.asset.findUniqueOrThrow({ where: { id: asset.id } });
      // Previously only the AssetTransfer row was written, so the register kept
      // showing the old owner while the transfer log disagreed.
      expect(after.projectId).toBe(projectId);
      expect(after.recordVersion).toBe(asset.recordVersion + 1);
    });

    it("records the transfer history as well", async () => {
      const asset = await newAsset();
      await transferAsset(tenantId, approver, asset.id, {
        fromType: "COMPANY", fromName: "GT Co", toType: "WAREHOUSE", toName: "Central Yard",
        transferredAt: new Date(), reason: "Off hire",
      });
      const after = await db.asset.findUniqueOrThrow({ where: { id: asset.id } });
      expect(after.currentLocation).toBe("Central Yard");
      expect(await db.assetTransfer.count({ where: { tenantId, assetId: asset.id } })).toBe(1);
    });

    it("moves ownership and custodian for the types that carry them", async () => {
      const asset = await newAsset();
      await transferAsset(tenantId, approver, asset.id, {
        fromType: "COMPANY", fromName: "GT Co", toType: "USER", toId: approver, toName: "GT app",
        transferredAt: new Date(), reason: "Issued to site manager",
      });
      expect((await db.asset.findUniqueOrThrow({ where: { id: asset.id } })).custodianId).toBe(approver);
    });

    // Asset has no team column, so a TEAM transfer is history-only rather than
    // writing a team name into an unrelated field.
    it("records a TEAM transfer without inventing a field to put it in", async () => {
      const asset = await newAsset();
      await transferAsset(tenantId, approver, asset.id, {
        fromType: "COMPANY", fromName: "GT Co", toType: "TEAM", toName: "Piling Crew",
        transferredAt: new Date(), reason: "Crew allocation",
      });
      const after = await db.asset.findUniqueOrThrow({ where: { id: asset.id } });
      expect(after.currentLocation).toBeNull();
      expect(after.department).toBeNull();
      expect(await db.assetTransfer.count({ where: { tenantId, assetId: asset.id } })).toBe(1);
    });

    it("still refuses to transfer a disposed asset", async () => {
      const asset = await db.asset.create({ data: { tenantId, name: "Scrapped mixer", type: "EQUIPMENT", status: "DISPOSED" } });
      await expect(
        transferAsset(tenantId, approver, asset.id, {
          fromType: "COMPANY", fromName: "GT Co", toType: "WAREHOUSE", toName: "Yard",
          transferredAt: new Date(), reason: "n/a",
        })
      ).rejects.toThrow(/Disposed or archived/i);
    });
  });
});
