import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { globalSearch } from "@/server/search";
import type { Role } from "@/lib/constants";

// globalSearch was rewritten to resolve its ten categories concurrently
// instead of one after another (nine sequential round trips, ~1.1s against a
// remote database, on every search). The refactor moved the permission gate
// from a helper that pushed into a shared array to one that returns its slice,
// so these are the guarantees that had to survive it:
//
//   - a task's own visibility is enforced, not just the category gate
//     (PRD_10 §12.3/FR-005);
//   - a category the role cannot READ collapses to a single `locked` marker
//     and never leaks a row;
//   - the locked marker itself must not reveal a count.
//
// The e2e spec that covered the first of these
// (project-company-interaction.spec.ts) is currently blocked by duplicate
// fixture data before it reaches its search assertions, so this asserts the
// same rules directly.
describe("globalSearch permissions", () => {
  let tenantId: string;
  let ownerId: string;
  let architectId: string;
  let stamp: string;
  const created: string[] = [];

  // globalSearch fans ten category queries out concurrently, so each call is a
  // burst of connections. Running one per assertion was enough extra load on
  // the shared pool to time out interactive transactions in OTHER test files
  // (contract-lifecycle, unit-sale-concurrency) — the suite runs its 28 files
  // in parallel against one remote database. So every search this file needs
  // is issued once here, and the cases assert against the captured results.
  let ownerStamped: Awaited<ReturnType<typeof globalSearch>> = [];
  let architectStamped: Awaited<ReturnType<typeof globalSearch>> = [];
  let ownerBroad: Awaited<ReturnType<typeof globalSearch>> = [];
  let architectBroad: Awaited<ReturnType<typeof globalSearch>> = [];

  beforeAll(async () => {
    const tenant = await db.tenant.findFirstOrThrow();
    tenantId = tenant.id;
    const owner = await db.userIdentity.findFirstOrThrow({ where: { username: "1" } });
    ownerId = owner.id;
    const architect = await db.userIdentity.findFirst({ where: { username: "elira.doda" } });
    architectId = architect?.id ?? owner.id;

    stamp = `srchperm${Date.now().toString(36)}`;
    for (const [suffix, visibility] of [
      ["public", "COMPANY_PUBLIC"],
      ["private", "PRIVATE"],
      ["dept", "DEPARTMENT_PUBLIC"],
    ] as const) {
      const task = await db.task.create({
        data: {
          tenantId,
          code: `${stamp}-${suffix}`.toUpperCase().slice(0, 30),
          title: `${stamp} ${suffix}`,
          visibility,
          departmentRole: visibility === "DEPARTMENT_PUBLIC" ? "FINANCE" : undefined,
          createdById: ownerId,
          mainResponsibleId: ownerId,
        },
      });
      created.push(task.id);
    }

    ownerStamped = await globalSearch(tenantId, ownerId, "OWNER" as Role, stamp);
    architectStamped = await globalSearch(tenantId, architectId, "ARCHITECT" as Role, stamp);
    ownerBroad = await globalSearch(tenantId, ownerId, "OWNER" as Role, "in");
    architectBroad = await globalSearch(tenantId, architectId, "ARCHITECT" as Role, "in");
  });

  afterAll(async () => {
    if (created.length) await db.task.deleteMany({ where: { id: { in: created } } });
  });

  it("returns the creator's own private task to the creator", () => {
    expect(ownerStamped.map((r) => r.title)).toContain(`${stamp} private`);
  });

  it("never returns another user's PRIVATE task", () => {
    expect(architectStamped.map((r) => r.title)).not.toContain(`${stamp} private`);
  });

  it("never returns a DEPARTMENT_PUBLIC task to a role outside that department", () => {
    expect(architectStamped.map((r) => r.title)).not.toContain(`${stamp} dept`);
  });

  it("still returns the company-public task to everyone", () => {
    expect(architectStamped.map((r) => r.title)).toContain(`${stamp} public`);
  });

  // A role without FINANCE READ must see at most the "request access" marker
  // for that category — never an invoice row, and never a number.
  it("collapses a category the role cannot read to a single locked marker with no count", () => {
    const invoices = architectBroad.filter((r) => r.type === "invoice");
    expect(invoices.length).toBeLessThanOrEqual(1);
    for (const row of invoices) {
      expect(row.locked).toBe(true);
      expect(row.href).toBe("#");
      expect(`${row.title} ${row.subtitle ?? ""}`).not.toMatch(/\d/);
    }
  });

  it("gives a role that can read the category real rows rather than a marker", () => {
    const invoices = ownerBroad.filter((r) => r.type === "invoice");
    expect(invoices.some((r) => r.locked)).toBe(false);
  });

  // Category order is the array order of the fan-out; it used to be the order
  // the sequential awaits ran in, and the UI groups on it.
  it("keeps categories in their established order", () => {
    const order = ["project", "task", "employee", "invoice", "client", "contractor", "contract", "supplier", "purchaseRequest", "rfq", "purchaseOrder", "hseReport", "document"];
    const seen = ownerBroad.map((r) => order.indexOf(r.type)).filter((i) => i >= 0);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });
});
