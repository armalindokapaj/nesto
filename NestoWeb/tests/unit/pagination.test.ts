import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { parsePageParams, toPaginatedResult, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/pagination";
import { listHseReportsPage, listHseReports, listIncidentsPage, listToolboxTalksPage } from "@/server/hse";
import { listInvoicesByTypePage } from "@/server/finance";

// Phase 4 — the lists that only ever grow were unbounded: every HSE page load
// pulled the tenant's entire history, with related records included per row.
describe("pagination", () => {
  describe("parsePageParams", () => {
    it("defaults to page 1 at the default size", () => {
      expect(parsePageParams({})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE, skip: 0, take: DEFAULT_PAGE_SIZE, pageKey: "page" });
    });

    it("computes skip from the page number", () => {
      const p = parsePageParams({ page: "3", pageSize: "10" });
      expect(p).toMatchObject({ page: 3, pageSize: 10, skip: 20, take: 10 });
    });

    // A route showing two lists needs two independent pagers, or paging one
    // silently pages the other and the second list looks empty.
    it("reads a prefixed param so two lists on one page do not share a pager", () => {
      const sp = { page: "2", talkPage: "4" };
      expect(parsePageParams(sp)).toMatchObject({ page: 2, pageKey: "page" });
      expect(parsePageParams(sp, "talk")).toMatchObject({ page: 4, pageKey: "talkPage" });
    });

    it("falls back to page 1 for a prefix that is absent from the URL", () => {
      expect(parsePageParams({ page: "7" }, "talk")).toMatchObject({ page: 1, pageKey: "talkPage" });
    });

    // A hand-edited URL must clamp, not error and not let someone ask for the
    // whole table by setting pageSize enormous — that would undo the phase.
    it("clamps hostile or nonsense parameters", () => {
      expect(parsePageParams({ page: "0" }).page).toBe(1);
      expect(parsePageParams({ page: "-5" }).page).toBe(1);
      expect(parsePageParams({ page: "abc" }).page).toBe(1);
      expect(parsePageParams({ pageSize: "99999" }).pageSize).toBe(MAX_PAGE_SIZE);
      expect(parsePageParams({ pageSize: "0" }).pageSize).toBe(DEFAULT_PAGE_SIZE);
      expect(parsePageParams({ page: "2.7" }).page).toBe(2);
    });
  });

  describe("toPaginatedResult", () => {
    it("reports at least one page for an empty list", () => {
      // "Page 1 of 0" reads like a bug to a user.
      expect(toPaginatedResult([], 0, parsePageParams({})).pageCount).toBe(1);
    });

    it("rounds the page count up for a partial last page", () => {
      expect(toPaginatedResult([], 51, parsePageParams({ pageSize: "25" })).pageCount).toBe(3);
    });
  });

  describe("against the database", () => {
    let tenantId: string;
    let userId: string;

    beforeAll(async () => {
      const stamp = Date.now();
      const tenant = await db.tenant.create({ data: { name: "Pagination Test", slug: `pagination-${stamp}` } });
      tenantId = tenant.id;
      const company = await db.company.create({ data: { tenantId, name: "PG Co", isParent: true } });
      const project = await db.project.create({ data: { tenantId, companyId: company.id, code: "PG-1", name: "PG Tower", status: "ON_TRACK" } });
      const user = await db.userIdentity.create({
        data: { email: `pg-${stamp}@test.local`, username: `pg${stamp}`, displayName: "PG User", passwordHash: "x" },
      });
      userId = user.id;
      await db.invoice.createMany({
        data: [
          { tenantId, projectId: project.id, number: `INV-${stamp}-1`, type: "INVOICE", amountMinor: 100_00, currency: "EUR", issuedDate: new Date() },
          { tenantId, projectId: project.id, number: `INV-${stamp}-2`, type: "INVOICE", amountMinor: 200_00, currency: "EUR", issuedDate: new Date() },
          { tenantId, projectId: project.id, number: `INV-${stamp}-3`, type: "INVOICE", amountMinor: 300_00, currency: "EUR", issuedDate: new Date() },
          { tenantId, projectId: project.id, number: `BIL-${stamp}-1`, type: "BILL", amountMinor: 50_00, currency: "EUR", issuedDate: new Date() },
        ],
      });
      await db.hseReport.createMany({
        data: Array.from({ length: 7 }, (_, i) => ({
          tenantId, projectId: project.id, reportedById: user.id,
          title: `Report ${i + 1}`, severity: "LOW", description: `Observation ${i + 1}`,
        })),
      });
    });

    afterAll(async () => {
      await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
      await db.userIdentity.delete({ where: { id: userId } }).catch(() => {});
    });

    it("bounds the query and reports the true total", async () => {
      const page = await listHseReportsPage(tenantId, parsePageParams({ page: "1", pageSize: "3" }));
      expect(page.items).toHaveLength(3);
      // The total counts every row, not just the page — otherwise the pager lies.
      expect(page.total).toBe(7);
      expect(page.pageCount).toBe(3);
    });

    it("returns the remainder on the last page and no overlap between pages", async () => {
      const size = { pageSize: "3" };
      const [p1, p2, p3] = await Promise.all([
        listHseReportsPage(tenantId, parsePageParams({ page: "1", ...size })),
        listHseReportsPage(tenantId, parsePageParams({ page: "2", ...size })),
        listHseReportsPage(tenantId, parsePageParams({ page: "3", ...size })),
      ]);
      expect(p3.items).toHaveLength(1);
      const ids = [...p1.items, ...p2.items, ...p3.items].map((r) => r.id);
      expect(new Set(ids).size).toBe(7);
    });

    it("returns an empty page past the end rather than throwing", async () => {
      const page = await listHseReportsPage(tenantId, parsePageParams({ page: "99", pageSize: "3" }));
      expect(page.items).toEqual([]);
      expect(page.total).toBe(7);
    });

    it("keeps the unbounded sibling available for callers that need every row", async () => {
      expect(await listHseReports(tenantId)).toHaveLength(7);
    });

    // The count must come from the same where clause as the rows. A paginated
    // list whose total is counted over the whole table reports a page count
    // that does not exist, and one counted over the page always says "1 of 1".
    it("counts only the rows matching the same filter as the page", async () => {
      const invoices = await listInvoicesByTypePage(tenantId, "INVOICE", parsePageParams({ pageSize: "2" }));
      const bills = await listInvoicesByTypePage(tenantId, "BILL", parsePageParams({ pageSize: "2" }));
      expect(invoices.total).toBe(3);
      expect(invoices.items).toHaveLength(2);
      expect(invoices.pageCount).toBe(2);
      // Bills are in the same table and must not be counted into the invoice total.
      expect(bills.total).toBe(1);
      expect(bills.pageCount).toBe(1);
    });

    // The HSE inductions route renders two lists. Each carries the search-param
    // name its own pager must write, or paging one would page the other.
    it("carries the param name each list's pager should drive", async () => {
      const incidents = await listIncidentsPage(tenantId, parsePageParams({}));
      const talks = await listToolboxTalksPage(tenantId, parsePageParams({}, "talk"));
      expect(incidents.pageKey).toBe("page");
      expect(talks.pageKey).toBe("talkPage");
    });
  });
});
