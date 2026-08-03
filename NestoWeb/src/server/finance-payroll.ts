import { db } from "@/lib/db";

// Normalizes any payment frequency to a monthly figure so mixed-frequency
// salary records can be summed into one payroll total.
const MONTHLY_FACTOR: Record<string, number> = {
  MONTHLY: 1,
  BIWEEKLY: 26 / 12,
  WEEKLY: 52 / 12,
  ANNUAL: 1 / 12,
};

// Finance's payroll/cost/forecast touchpoint — reads the CURRENT SalaryRecord
// directly (HR's source of truth) rather than maintaining a separate
// Finance-owned salary figure. EUR and ALL are summed separately since
// converting between currencies isn't in scope.
export async function getPayrollSummary(tenantId: string) {
  const records = await db.salaryRecord.findMany({
    where: { tenantId, status: "CURRENT", employee: { status: "ACTIVE" } },
    select: { currency: true, grossSalary: true, netSalary: true, paymentFrequency: true },
  });

  const totals: Record<string, { headcount: number; monthlyGross: number; monthlyNet: number }> = {};
  for (const r of records) {
    const factor = MONTHLY_FACTOR[r.paymentFrequency] ?? 1;
    const bucket = (totals[r.currency] ??= { headcount: 0, monthlyGross: 0, monthlyNet: 0 });
    bucket.headcount += 1;
    bucket.monthlyGross += r.grossSalary * factor;
    bucket.monthlyNet += r.netSalary * factor;
  }

  return Object.entries(totals).map(([currency, t]) => ({
    currency,
    headcount: t.headcount,
    monthlyGross: t.monthlyGross,
    monthlyNet: t.monthlyNet,
    annualGross: t.monthlyGross * 12,
    annualNet: t.monthlyNet * 12,
  }));
}
