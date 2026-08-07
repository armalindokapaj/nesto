import "server-only";
import { db } from "@/lib/db";

// PRD_Finance_Dashboard §4 "Other" sidebar group — Loans and Investments,
// kept intentionally minimal (list + record) so the sidebar item isn't a
// dead link. No amortization/valuation engine in v1.

export async function listLoans(tenantId: string, companyId?: string) {
  return db.loan.findMany({ where: { tenantId, companyId }, orderBy: { startDate: "desc" } });
}

export async function createLoan(
  tenantId: string,
  actorId: string,
  input: {
    companyId: string;
    lender: string;
    principal: number;
    currency: string;
    interestRate?: number;
    outstanding: number;
    startDate: Date;
    maturityDate?: Date | null;
    notes?: string;
  }
) {
  return db.loan.create({ data: { tenantId, createdById: actorId, ...input } });
}

export async function listInvestments(tenantId: string, companyId?: string) {
  return db.investment.findMany({ where: { tenantId, companyId }, orderBy: { startDate: "desc" } });
}

export async function createInvestment(
  tenantId: string,
  actorId: string,
  input: {
    companyId: string;
    name: string;
    type: string;
    amount: number;
    currency: string;
    currentValue?: number;
    startDate: Date;
    maturityDate?: Date | null;
    notes?: string;
  }
) {
  return db.investment.create({ data: { tenantId, createdById: actorId, ...input } });
}
