import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { getBudget, createSpendingBill, submitSpendingBill } from "@/server/finance";
import { getProjectFinanceDashboardData } from "@/server/project-finance";
import { toMinorUnits } from "@/lib/money";

/**
 * These cover the boundary where a decimal-Float money column meets integer
 * minor units. Half the schema is migrated and half is not, so this boundary
 * exists in real code and both sides are `number` — the type checker cannot
 * see a mistake here, and the wrong answer is plausible-looking rather than
 * obviously broken. Each case below is a bug that was actually live.
 */
describe("money unit boundaries", () => {
  let tenantId: string;
  let userId: string;
  let companyId: string;
  let projectId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    const tenant = await db.tenant.create({ data: { name: "Money Units", slug: `money-units-${stamp}` } });
    tenantId = tenant.id;
    const company = await db.company.create({ data: { tenantId, name: "MU Co", isParent: true } });
    companyId = company.id;
    const project = await db.project.create({
      data: { tenantId, companyId, code: "MU-1", name: "MU Tower", status: "ON_TRACK", budget: 100_000 },
    });
    projectId = project.id;
    const user = await db.userIdentity.create({
      data: { email: `mu-${stamp}@test.local`, username: `mu${stamp}`, displayName: "MU User", passwordHash: "x" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    await db.userIdentity.delete({ where: { id: userId } }).catch(() => {});
  });

  it("does not flag a bill as over budget when it is well inside the budget", async () => {
    // €100,000 budget, €500 bill. Comparing the bill's 50,000 minor units
    // against the raw 100,000 baseline made this "over budget" — and that flag
    // drives approval routing, so it is not a cosmetic problem.
    await db.budget.create({
      data: { tenantId, companyId, period: "2026", baselineAmount: 100_000, currency: "EUR", status: "ACTIVE", createdById: userId },
    });
    const draft = await createSpendingBill(tenantId, userId, {
      companyId, category: "MATERIALS", description: "Small purchase", amount: 500, currency: "EUR", evidenceWaived: true,
    });
    const submitted = await submitSpendingBill(tenantId, userId, draft.id);
    expect(submitted.overBudget).toBe(false);
  });

  it("still flags a bill that genuinely exceeds the budget", async () => {
    // The mirror case, so the fix cannot be "always return false".
    // A second company so its own ACTIVE budget is the one resolved.
    const small = await db.company.create({ data: { tenantId, name: "MU Small Co" } });
    await db.budget.create({
      data: { tenantId, companyId: small.id, period: "2026", baselineAmount: 100, currency: "EUR", status: "ACTIVE", createdById: userId },
    });
    const draft = await createSpendingBill(tenantId, userId, {
      companyId: small.id, category: "MATERIALS", description: "Too big", amount: 250, currency: "EUR", evidenceWaived: true,
    });
    const submitted = await submitSpendingBill(tenantId, userId, draft.id);
    expect(submitted.overBudget).toBe(true);
  });

  it("reports budget remaining in the same unit as the spend", async () => {
    const util = await db.company.create({ data: { tenantId, name: "MU Util Co" } });
    const budget = await db.budget.create({
      data: { tenantId, companyId: util.id, period: "2026", baselineAmount: 10_000, currency: "EUR", status: "ACTIVE", createdById: userId },
    });
    const draft = await createSpendingBill(tenantId, userId, {
      companyId: util.id, category: "MATERIALS", description: "Spend", amount: 2_500, currency: "EUR", evidenceWaived: true,
    });
    await submitSpendingBill(tenantId, userId, draft.id);

    const utilisation = await getBudget(tenantId, budget.id);
    expect(utilisation.baselineAmountMinor).toBe(toMinorUnits(10_000));
    // Committed, not actual: a new bill is pending, not paid.
    expect(utilisation.committedMinor).toBe(toMinorUnits(2_500));
    // Subtracting minor from major used to give 10_000 - 250_000 = -240_000,
    // i.e. a €10k budget reporting a quarter-million overspend.
    expect(utilisation.remainingMinor).toBe(toMinorUnits(7_500));
    expect(utilisation.remainingMinor).toBeGreaterThan(0);
  });

  it("keeps a project's budget and its spend comparable", async () => {
    const data = await getProjectFinanceDashboardData(tenantId, projectId);
    expect(data.budgetMinor).toBe(toMinorUnits(100_000));
    // Nothing has been spent on this project, so remaining is the whole budget.
    expect(data.remainingMinor).toBe(data.budgetMinor);
  });
});
