import { db } from "@/lib/db";

export async function getCompanyProfile(tenantId: string) {
  return db.company.findFirst({
    where: { tenantId },
    include: { branches: true },
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
