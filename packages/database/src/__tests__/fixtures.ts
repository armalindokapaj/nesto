import type { ExecutionContext } from "@nesto/contracts";
import { newId } from "../id";
import { unscopedScope } from "../unit-of-work";

export type Fixture = {
  tenantId: string;
  companyId: string;
  userId: string;
  ctx: ExecutionContext;
};

export function contextFor(tenantId: string, companyId?: string, userId?: string): ExecutionContext {
  return {
    requestId: newId(),
    correlationId: newId(),
    actorType: "USER",
    actorId: userId ?? newId(),
    audience: "COMPANY",
    tenantId,
    activeCompanyId: companyId,
    locale: "en",
    now: new Date().toISOString(),
  };
}

let counter = 0;

/** Creates an isolated tenant with one company. Uses the platform audience,
 *  because bootstrapping a tenant necessarily happens before there is a tenant
 *  context to bootstrap it in. */
export async function createTenantFixture(label: string): Promise<Fixture> {
  const tenantId = newId();
  const companyId = newId();
  const userId = newId();
  const n = ++counter;

  await unscopedScope(async (tx) => {
    await tx.tenant.create({
      data: { id: tenantId, name: `${label}-${n}`, createdBy: userId, updatedBy: userId },
    });
    await tx.company.create({
      data: {
        id: companyId,
        tenantId,
        legalName: `${label} ${n} sh.p.k.`,
        displayName: `${label} ${n}`,
        slug: `${label.toLowerCase()}-${n}-${Date.now()}`,
        countryCode: "AL",
        lifecycleStatus: "ACTIVE",
        createdBy: userId,
        updatedBy: userId,
      },
    });
  });

  return { tenantId, companyId, userId, ctx: contextFor(tenantId, companyId, userId) };
}
