import { db } from "@/lib/db";

// Company profile — read and update of the company record itself. Separate
// from company-modules.ts, which owns per-company module enablement (a
// different lifecycle: profile edits are routine, module toggles change what
// the whole nav shows).

export async function getCompanyProfile(tenantId: string) {
  return db.company.findFirst({
    where: { tenantId },
    include: { branches: true, childCompanies: { include: { branches: true } } },
  });
}

export async function updateCompanyProfile(
  tenantId: string,
  companyId: string,
  input: { legalName?: string; countryCode?: string }
) {
  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company || company.tenantId !== tenantId) {
    throw new Error("Company not found.");
  }
  return db.company.update({ where: { id: companyId }, data: input });
}
