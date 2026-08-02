import { db } from "@/lib/db";
import { allocateNumber } from "@/server/number-series";
import { assertTenant } from "@/lib/tenant";

export async function listContractors(tenantId: string) {
  return db.contractor.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getContractor(tenantId: string, contractorId: string) {
  const contractor = await db.contractor.findUnique({
    where: { id: contractorId },
    include: {
      contracts: {
        include: { project: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  return assertTenant(contractor, tenantId, "Contractor");
}

export async function createContractor(
  tenantId: string,
  input: { name: string; tradeType: string; email?: string; phone?: string }
) {
  const number = await allocateNumber(tenantId, "CONTRACTOR");
  return db.contractor.create({
    data: {
      tenantId,
      number,
      name: input.name,
      tradeType: input.tradeType,
      email: input.email,
      phone: input.phone,
    },
  });
}
