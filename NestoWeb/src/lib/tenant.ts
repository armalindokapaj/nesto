import "server-only";
import { db } from "@/lib/db";

// Every function in src/server/*.ts takes `tenantId` as an explicit, required
// first argument and threads it into every `where` clause. That's a
// deliberate choice over a "magic" Prisma Client Extension that silently
// rewrites queries: a missing tenantId argument is a TypeScript compile
// error here, whereas a global auto-scoping extension can fail silently on
// raw queries, nested writes, or a future model someone forgets to register.
// TEN-001 (strict tenant isolation) is enforced by this call-shape, and
// verified by the tenant-isolation tests in tests/tenant-isolation.test.ts.

export class TenantMismatchError extends Error {
  constructor(entity: string) {
    super(`Cross-tenant access denied for ${entity}`);
    this.name = "TenantMismatchError";
  }
}

/** Throws if a fetched record's tenantId doesn't match the caller's session tenant. */
export function assertTenant<T extends { tenantId: string }>(
  record: T | null,
  tenantId: string,
  entity = "record"
): T {
  if (!record || record.tenantId !== tenantId) {
    throw new TenantMismatchError(entity);
  }
  return record;
}

// Audit C5 — nested-write nested-relation validators. A foreign key existing
// in the database proves nothing about which tenant it belongs to; every
// creation/update path that accepts a client-supplied ID for another tenant
// -scoped record must resolve and check it inside the same request, not
// trust it because the FK constraint alone let the write through. Call these
// for every optional-but-present foreign ID before the actual write.

export async function requireTenantProject(tenantId: string, projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { tenantId: true } });
  assertTenant(project, tenantId, "Project");
}

export async function requireTenantClient(tenantId: string, clientId: string) {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { tenantId: true } });
  assertTenant(client, tenantId, "Client");
}

export async function requireTenantContractor(tenantId: string, contractorId: string) {
  const contractor = await db.contractor.findUnique({ where: { id: contractorId }, select: { tenantId: true } });
  assertTenant(contractor, tenantId, "Contractor");
}

export async function requireTenantContract(tenantId: string, contractId: string) {
  const contract = await db.contract.findUnique({ where: { id: contractId }, select: { tenantId: true } });
  assertTenant(contract, tenantId, "Contract");
}

export async function requireTenantSupplier(tenantId: string, supplierId: string) {
  const supplier = await db.supplier.findUnique({ where: { id: supplierId }, select: { tenantId: true } });
  assertTenant(supplier, tenantId, "Supplier");
}

export async function requireTenantTask(tenantId: string, taskId: string) {
  const task = await db.task.findUnique({ where: { id: taskId }, select: { tenantId: true } });
  assertTenant(task, tenantId, "Task");
}

export async function requireTenantUnit(tenantId: string, unitId: string) {
  const unit = await db.unit.findUnique({ where: { id: unitId }, select: { tenantId: true } });
  assertTenant(unit, tenantId, "Unit");
}

// A UserIdentity is tenant-less by design (one login, many tenant
// memberships) — so "does this user belong to this tenant" can only be
// answered by whether a CompanyMembership row links them, not by any field
// on UserIdentity itself.
export async function requireTenantMember(tenantId: string, userId: string) {
  const membership = await db.companyMembership.findUnique({ where: { tenantId_userId: { tenantId, userId } } });
  if (!membership) throw new TenantMismatchError("User");
}

// A movement line, a stock balance and most inventory rows carry no currency
// of their own — the tenant's default is the currency they are denominated in.
// Needed wherever a decimal amount crosses into integer minor units, because
// the minor-unit factor is currency-dependent (see lib/money.ts).
export async function tenantDefaultCurrency(tenantId: string): Promise<string> {
  const settings = await db.tenantSettings.findUnique({ where: { tenantId }, select: { defaultCurrency: true } });
  return settings?.defaultCurrency ?? "EUR";
}
