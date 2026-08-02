import { db } from "@/lib/db";
import { allocateNumber } from "@/server/number-series";

export async function listContracts(tenantId: string) {
  return db.contract.findMany({
    where: { tenantId },
    include: { project: true, contractor: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listContractsByProject(tenantId: string, projectId: string) {
  return db.contract.findMany({
    where: { tenantId, projectId },
    include: { contractor: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createContract(
  tenantId: string,
  input: {
    title: string;
    value: number;
    currency?: string;
    projectId?: string;
    contractorId?: string;
    startDate?: Date;
    endDate?: Date;
  }
) {
  const number = await allocateNumber(tenantId, "CONTRACT");
  return db.contract.create({
    data: {
      tenantId,
      number,
      title: input.title,
      value: input.value,
      currency: input.currency ?? "EUR",
      projectId: input.projectId,
      contractorId: input.contractorId,
      startDate: input.startDate,
      endDate: input.endDate,
    },
  });
}
