import type { FixtureContext } from "./context";
import { withColdStartRetry } from "./context";
import { createVacancy, createCandidate, setCandidateStage, createOffer, setOfferStatus } from "@/server/recruitment";
import { createShiftDefinition, assignSchedule } from "@/server/attendance";
import { createPayrollGroup, createPayrollRun, calculatePayrollRun, lockPayrollRun } from "@/server/payroll";

export async function seedHrExtended(ctx: FixtureContext) {
  const { db, tenantId, companyId, owner, employees } = ctx;
  console.log("HR extended (Recruitment, Attendance, Payroll)…");

  // --- Recruitment ---------------------------------------------------------
  if (!(await db.vacancy.findFirst({ where: { tenantId } }))) {
    const vacancy = await createVacancy(tenantId, owner.id, { title: "Site Engineer", department: "Construction", position: "Site Engineer", headcount: 2 });
    console.log("  + Vacancy: Site Engineer");

    const c1 = await createCandidate(tenantId, owner.id, { vacancyId: vacancy.id, fullName: "Endrit Berisha", email: "endrit.berisha@example.com", source: "LinkedIn" });
    await setCandidateStage(tenantId, owner.id, c1.id, "SCREENING");
    await setCandidateStage(tenantId, owner.id, c1.id, "INTERVIEW");
    await setCandidateStage(tenantId, owner.id, c1.id, "OFFER");
    const offer = await createOffer(tenantId, owner.id, { candidateId: c1.id, position: "Site Engineer", compensation: 2200, currency: "EUR" });
    await setOfferStatus(tenantId, owner.id, offer.id, "ACCEPTED"); // auto-advances candidate to HIRED

    const c2 = await createCandidate(tenantId, owner.id, { vacancyId: vacancy.id, fullName: "Mirela Cani", email: "mirela.cani@example.com", source: "Referral" });
    await setCandidateStage(tenantId, owner.id, c2.id, "SCREENING");

    const vacancy2 = await createVacancy(tenantId, owner.id, { title: "QA Inspector", department: "Quality", position: "QA Inspector", headcount: 1 });
    await createCandidate(tenantId, owner.id, { vacancyId: vacancy2.id, fullName: "Arta Dumani", source: "Job Board" });
    console.log("  + Candidates + accepted offer (Endrit Berisha hired)");
  }

  // --- Attendance & Scheduling ----------------------------------------------
  if (!(await db.shiftDefinition.findFirst({ where: { tenantId } }))) {
    const dayShift = await createShiftDefinition(tenantId, owner.id, { name: "Day Shift", startTime: "07:00", endTime: "15:00", daysOfWeek: ["MON", "TUE", "WED", "THU", "FRI"] });
    await createShiftDefinition(tenantId, owner.id, { name: "Site Weekend Shift", startTime: "08:00", endTime: "14:00", daysOfWeek: ["SAT"] });
    console.log("  + Shifts: Day Shift, Site Weekend Shift");

    const siteEmployees = employees.filter((e) => e.department === "Construction").slice(0, 3);
    for (const emp of siteEmployees) {
      await assignSchedule(tenantId, owner.id, emp.id, dayShift.id);
    }
    console.log(`  + Assigned Day Shift to ${siteEmployees.length} employee(s)`);

    // Clock events across the last few days for the first site employee, so
    // the attendance summary table has real worked-hours rows.
    const worker = siteEmployees[0];
    if (worker) {
      for (let d = 3; d >= 1; d--) {
        const clockIn = new Date();
        clockIn.setDate(clockIn.getDate() - d);
        clockIn.setHours(7, 5, 0, 0);
        const clockOut = new Date(clockIn);
        clockOut.setHours(15, 10, 0, 0);
        await db.attendanceEvent.create({ data: { tenantId, employeeId: worker.id, type: "CLOCK_IN", occurredAt: clockIn, recordedById: worker.userId ?? owner.id } });
        await db.attendanceEvent.create({ data: { tenantId, employeeId: worker.id, type: "CLOCK_OUT", occurredAt: clockOut, recordedById: worker.userId ?? owner.id } });
      }
      console.log(`  + 3 days of clock-in/out events for ${worker.fullName}`);
    }
  }

  // --- Payroll (Phase-2, locked/immutable run) ------------------------------
  if (!(await db.payrollGroup.findFirst({ where: { tenantId } }))) {
    const group = await createPayrollGroup(tenantId, { companyId, name: "Monthly Payroll — HQ", frequency: "MONTHLY", currency: "EUR" });
    console.log("  + PayrollGroup: Monthly Payroll — HQ");

    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setMonth(periodStart.getMonth() - 1);
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    periodEnd.setDate(0);
    const payDate = new Date(periodEnd);
    payDate.setDate(payDate.getDate() + 5);

    const run = await withColdStartRetry(() => createPayrollRun(tenantId, owner.id, { payrollGroupId: group.id, periodStart, periodEnd, payDate }));
    try {
      await calculatePayrollRun(tenantId, owner.id, run.id);
      await lockPayrollRun(tenantId, owner.id, run.id);
      console.log("  + PayrollRun calculated and locked (last month)");
    } catch (e) {
      console.log(`  ! PayrollRun left in draft (calc needs SalaryRecord/EmploymentRelationship on more employees): ${e instanceof Error ? e.message : e}`);
    }

    // A second, still-open run for the current period so the UI shows both
    // a locked historical run and a draft one in progress.
    const currentStart = new Date();
    currentStart.setDate(1);
    const currentEnd = new Date(currentStart);
    currentEnd.setMonth(currentEnd.getMonth() + 1);
    currentEnd.setDate(0);
    const currentPay = new Date(currentEnd);
    currentPay.setDate(currentPay.getDate() + 5);
    await createPayrollRun(tenantId, owner.id, { payrollGroupId: group.id, periodStart: currentStart, periodEnd: currentEnd, payDate: currentPay });
    console.log("  + PayrollRun (current period, draft)");
  }
}
