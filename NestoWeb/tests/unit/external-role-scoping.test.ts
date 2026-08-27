import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { can, isExternalRole, EXTERNAL_ROLES, DASHBOARD_BY_ROLE } from "@/lib/permissions";
import { workspaceKeyFromPath, NAV_SECTIONS, visibleNavSections } from "@/lib/nav-config";
import { getPortalDashboardData } from "@/server/portal-dashboard";
import { grantProjectAccess, addPortalMember, createExternalOrganization, revokeProjectAccess } from "@/server/portal-access";
import type { Role } from "@/lib/constants";

// Phase 8 — /dashboard/executive reports tenant-wide figures and was the
// landing page for CLIENT and VIEWER, with no permission gate of any kind.
// It is also the target of 244 `redirect("/dashboard/executive")` calls, so
// it was the app's universal denied-access fallback: any external login
// bounced off a restricted page landed on the full company portfolio.
describe("external role scoping", () => {
  describe("permission matrix", () => {
    it("gives external roles no general module at all", () => {
      const GENERAL = ["PROJECTS", "TASKS", "CONTRACTS", "COMPANY_NETWORK", "DOCUMENTS", "FINANCE", "HR", "LEGAL", "PROCUREMENT"] as const;
      for (const role of EXTERNAL_ROLES) {
        for (const resource of GENERAL) {
          expect(can(role, resource, "READ"), `${role} must not read ${resource}`).toBe(false);
        }
      }
    });

    // /contracts gates on can(role, "CONTRACTS", "READ") and then runs
    // listContracts(tenantId) with no row scoping, so resource-level READ
    // meant every contract's value and counterparty.
    it("keeps a client out of the unscoped company-wide contract list", () => {
      expect(can("CLIENT", "CONTRACTS", "READ")).toBe(false);
    });

    // listModuleDocuments() only applies its userId to the STARRED and MINE
    // scopes; the default "ALL" scope returns the tenant's whole corpus.
    it("keeps a contractor out of the unscoped company-wide document corpus", () => {
      expect(can("CONTRACTOR", "DOCUMENTS", "READ")).toBe(false);
    });

    it("treats VIEWER as internal, keeping company-wide project visibility", () => {
      // "Viewer / Trainee" is an internal read-only seat, and PRD_10 §5.1
      // makes projects discoverable to every company member.
      expect(isExternalRole("VIEWER")).toBe(false);
      expect(can("VIEWER", "PROJECTS", "READ")).toBe(true);
    });
  });

  describe("routing", () => {
    it("never sends an external role to the executive console", () => {
      for (const role of EXTERNAL_ROLES) {
        expect(DASHBOARD_BY_ROLE[role]).not.toBe("/dashboard/executive");
      }
    });

    // Without its own NAV_SECTIONS entry, workspaceKeyFromPath() falls through
    // to "executive" — which would hand a client the executive sidebar even
    // with the right dashboard, since its Projects / Employee Directory /
    // My Payslips items carry no `resource` for the can() filter to strip.
    it("gives every external role its own sidebar rather than the executive fallback", () => {
      for (const role of EXTERNAL_ROLES) {
        const homeKey = DASHBOARD_BY_ROLE[role].replace("/dashboard/", "");
        expect(homeKey in NAV_SECTIONS, `NAV_SECTIONS is missing "${homeKey}"`).toBe(true);
        expect(workspaceKeyFromPath(DASHBOARD_BY_ROLE[role], role)).toBe(homeKey);
      }
    });

    it("keeps an external role in its own shell even on a denied-page bounce", () => {
      // The 244 fallbacks send them to /dashboard/executive; the gate on that
      // page redirects onward, and the shell must not follow the path there.
      for (const role of EXTERNAL_ROLES) {
        expect(workspaceKeyFromPath("/dashboard/executive", role)).not.toBe("executive");
      }
    });

    it("offers a client no navigation beyond their own console", () => {
      const sections = visibleNavSections(NAV_SECTIONS.portal, "CLIENT" as Role, new Set(), new Set());
      const hrefs = sections.flatMap((s) => s.items.map((i) => i.href));
      expect(hrefs).toEqual(["/dashboard/portal"]);
    });
  });

  describe("portal dashboard data", () => {
    let tenantId: string;
    let otherTenantId: string;
    let clientUserId: string;
    let grantedProjectId: string;
    let ungrantedProjectId: string;
    let orgId: string;

    beforeAll(async () => {
      const stamp = Date.now();
      const tenant = await db.tenant.create({ data: { name: "Portal Test", slug: `portal-test-${stamp}` } });
      tenantId = tenant.id;
      const other = await db.tenant.create({ data: { name: "Portal Other", slug: `portal-other-${stamp}` } });
      otherTenantId = other.id;

      const company = await db.company.create({ data: { tenantId, name: "PT Co", isParent: true } });
      const staff = await db.userIdentity.create({
        data: { email: `pt-staff-${stamp}@test.local`, username: `ptstaff${stamp}`, displayName: "PT Staff", passwordHash: "x" },
      });
      const clientUser = await db.userIdentity.create({
        data: { email: `pt-client-${stamp}@test.local`, username: `ptclient${stamp}`, displayName: "PT Client", passwordHash: "x" },
      });
      clientUserId = clientUser.id;
      await db.companyMembership.create({ data: { tenantId, userId: clientUser.id, role: "CLIENT" } });

      const granted = await db.project.create({
        data: { tenantId, companyId: company.id, code: "PT-1", name: "Granted Tower", status: "AT_RISK", progressPct: 40, clientName: "Acme Holdings" },
      });
      const ungranted = await db.project.create({
        data: { tenantId, companyId: company.id, code: "PT-2", name: "Someone Else's Villa", status: "DELAYED", progressPct: 10, clientName: "Rival Group" },
      });
      grantedProjectId = granted.id;
      ungrantedProjectId = ungranted.id;

      const org = await createExternalOrganization(tenantId, staff.id, { name: "Acme Holdings", orgType: "CLIENT" });
      orgId = org.id;
      await addPortalMember(tenantId, staff.id, org.id, clientUser.id);
      await grantProjectAccess(tenantId, staff.id, org.id, granted.id);
    });

    afterAll(async () => {
      await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
      await db.tenant.delete({ where: { id: otherTenantId } }).catch(() => {});
      await db.userIdentity.deleteMany({ where: { id: clientUserId } }).catch(() => {});
    });

    it("returns only the projects explicitly granted to the client's organization", async () => {
      const data = await getPortalDashboardData(tenantId, clientUserId);
      const ids = data.projects.map((p) => p.id);
      expect(ids).toContain(grantedProjectId);
      expect(ids).not.toContain(ungrantedProjectId);
    });

    it("never carries another client's name off a project record", async () => {
      const data = await getPortalDashboardData(tenantId, clientUserId);
      // The executive console selected the whole project row and rendered
      // `clientName` under each of the five most recent projects, which is
      // how one client learned who the others were.
      expect(JSON.stringify(data)).not.toContain("Rival Group");
      for (const p of data.projects) expect(p).not.toHaveProperty("clientName");
    });

    it("counts only the client's own projects, not the tenant's", async () => {
      const data = await getPortalDashboardData(tenantId, clientUserId);
      expect(data.activeCount).toBe(1);
      expect(data.attentionCount).toBe(1); // the granted one is AT_RISK
    });

    it("shows nothing at all to a client with no grants", async () => {
      const stray = await db.userIdentity.create({
        data: { email: `pt-stray-${Date.now()}@test.local`, username: `ptstray${Date.now()}`, displayName: "Stray", passwordHash: "x" },
      });
      const data = await getPortalDashboardData(tenantId, stray.id);
      // Deny-by-default. Previously this user saw the entire portfolio.
      expect(data.projects).toEqual([]);
      expect(data.activeCount).toBe(0);
      await db.userIdentity.delete({ where: { id: stray.id } }).catch(() => {});
    });

    it("drops a project as soon as its grant is revoked", async () => {
      const access = await db.businessAccessRelationship.findFirst({ where: { tenantId, externalOrgId: orgId, projectId: grantedProjectId } });
      await revokeProjectAccess(tenantId, access!.id);
      const data = await getPortalDashboardData(tenantId, clientUserId);
      expect(data.projects).toEqual([]);
      await grantProjectAccess(tenantId, clientUserId, orgId, grantedProjectId);
    });
  });
});
