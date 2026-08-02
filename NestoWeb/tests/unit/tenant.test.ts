import { describe, it, expect } from "vitest";
import { assertTenant, TenantMismatchError } from "@/lib/tenant";

describe("assertTenant (TEN-001 tenant isolation)", () => {
  it("returns the record when the tenant matches", () => {
    const record = { id: "proj_1", tenantId: "tenant_a", name: "Riverside Towers" };
    expect(assertTenant(record, "tenant_a")).toBe(record);
  });

  it("throws when the record belongs to a different tenant", () => {
    const record = { id: "proj_1", tenantId: "tenant_b", name: "Riverside Towers" };
    expect(() => assertTenant(record, "tenant_a", "Project")).toThrow(TenantMismatchError);
    expect(() => assertTenant(record, "tenant_a", "Project")).toThrow(/Project/);
  });

  it("throws when the record is null (not found, or found in another tenant and filtered out)", () => {
    expect(() => assertTenant(null, "tenant_a")).toThrow(TenantMismatchError);
  });
});
