import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  requireTenantProject,
  requireTenantClient,
  requireTenantContractor,
  requireTenantContract,
  requireTenantSupplier,
  requireTenantTask,
  requireTenantMember,
  TenantMismatchError,
} from "@/lib/tenant";

// Audit C5 — "no negative API/action tests for foreign-tenant IDs" was a
// named testing gap. This seeds two throwaway tenants and proves each
// requireTenant* validator rejects an ID that's real but belongs to the
// *other* tenant, not just a nonexistent ID.
describe("cross-tenant nested-write validators (audit C5)", () => {
  let tenantA: { id: string };
  let tenantB: { id: string };
  let userInB: { id: string };
  let projectInB: { id: string };
  let clientInB: { id: string };
  let contractorInB: { id: string };
  let contractInB: { id: string };
  let supplierInB: { id: string };
  let taskInB: { id: string };

  beforeAll(async () => {
    const stamp = Date.now();
    tenantA = await db.tenant.create({ data: { name: "Audit Test Tenant A", slug: `audit-test-a-${stamp}` } });
    tenantB = await db.tenant.create({ data: { name: "Audit Test Tenant B", slug: `audit-test-b-${stamp}` } });
    const companyB = await db.company.create({ data: { tenantId: tenantB.id, name: "Company B", isParent: true } });

    const user = await db.userIdentity.create({
      data: { email: `audit-b-${Date.now()}@test.local`, username: `auditb${Date.now()}`, displayName: "B User", passwordHash: "x" },
    });
    userInB = user;
    await db.companyMembership.create({ data: { tenantId: tenantB.id, userId: user.id, role: "OWNER" } });

    projectInB = await db.project.create({
      data: { tenantId: tenantB.id, companyId: companyB.id, code: "PB-1", name: "Project B", status: "ON_TRACK" },
    });
    clientInB = await db.client.create({ data: { tenantId: tenantB.id, name: "Client B", createdById: user.id } });
    contractorInB = await db.contractor.create({ data: { tenantId: tenantB.id, number: "CTR-B-1", name: "Contractor B", tradeType: "Electrical" } });
    contractInB = await db.contract.create({ data: { tenantId: tenantB.id, number: "CON-B-1", title: "Contract B", value: 1000 } });
    supplierInB = await db.supplier.create({ data: { tenantId: tenantB.id, number: "SUP-B-1", name: "Supplier B", category: "Steel" } });
    taskInB = await db.task.create({ data: { tenantId: tenantB.id, code: "TSK-B-1", title: "Task B", createdById: user.id } });
  });

  afterAll(async () => {
    await db.tenant.delete({ where: { id: tenantB.id } });
    await db.tenant.delete({ where: { id: tenantA.id } });
    // UserIdentity is tenant-less by design, so it isn't cascade-deleted
    // with tenantB above — clean it up explicitly.
    await db.userIdentity.delete({ where: { id: userInB.id } });
  });

  it("rejects a real project ID that belongs to a different tenant", async () => {
    await expect(requireTenantProject(tenantA.id, projectInB.id)).rejects.toThrow(TenantMismatchError);
  });

  it("rejects a real client ID that belongs to a different tenant", async () => {
    await expect(requireTenantClient(tenantA.id, clientInB.id)).rejects.toThrow(TenantMismatchError);
  });

  it("rejects a real contractor ID that belongs to a different tenant", async () => {
    await expect(requireTenantContractor(tenantA.id, contractorInB.id)).rejects.toThrow(TenantMismatchError);
  });

  it("rejects a real contract ID that belongs to a different tenant", async () => {
    await expect(requireTenantContract(tenantA.id, contractInB.id)).rejects.toThrow(TenantMismatchError);
  });

  it("rejects a real supplier ID that belongs to a different tenant", async () => {
    await expect(requireTenantSupplier(tenantA.id, supplierInB.id)).rejects.toThrow(TenantMismatchError);
  });

  it("rejects a real task ID that belongs to a different tenant", async () => {
    await expect(requireTenantTask(tenantA.id, taskInB.id)).rejects.toThrow(TenantMismatchError);
  });

  it("rejects a real user who has no membership in the target tenant", async () => {
    await expect(requireTenantMember(tenantA.id, userInB.id)).rejects.toThrow(TenantMismatchError);
  });

  it("accepts each ID when checked against its own real tenant", async () => {
    await expect(requireTenantProject(tenantB.id, projectInB.id)).resolves.toBeUndefined();
    await expect(requireTenantClient(tenantB.id, clientInB.id)).resolves.toBeUndefined();
    await expect(requireTenantContractor(tenantB.id, contractorInB.id)).resolves.toBeUndefined();
    await expect(requireTenantContract(tenantB.id, contractInB.id)).resolves.toBeUndefined();
    await expect(requireTenantSupplier(tenantB.id, supplierInB.id)).resolves.toBeUndefined();
    await expect(requireTenantTask(tenantB.id, taskInB.id)).resolves.toBeUndefined();
    await expect(requireTenantMember(tenantB.id, userInB.id)).resolves.toBeUndefined();
  });
});
