import "server-only";

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
