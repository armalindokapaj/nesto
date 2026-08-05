import { describe, it, expect } from "vitest";
import {
  isConfigEnabled,
  buildConfigResolver,
  disabledRoutes,
  getAncestorKeys,
  getConfigNode,
  CONFIG_NODES,
  type ConfigOverrides,
} from "@/lib/platform-config";
import { visibleNavSections, type NavSection } from "@/lib/nav-config";
import { FileText } from "lucide-react";

// Platform Configuration cascade. This is the logic 7 of the 8 module PRDs
// lean on for "disabled functionality must disappear from navigation, search,
// APIs and layouts without dead links or blank spaces", so the precedence and
// inheritance rules are pinned here rather than discovered in the UI.

const none: ConfigOverrides = { tenant: {} };

describe("platform configuration catalog", () => {
  it("ships everything enabled when no override rows exist", () => {
    for (const node of CONFIG_NODES) {
      expect(isConfigEnabled(node.key, none)).toBe(true);
    }
  });

  it("every declared parent exists in the catalog", () => {
    for (const node of CONFIG_NODES) {
      if (node.parent) expect(getConfigNode(node.parent), `missing parent for ${node.key}`).toBeDefined();
    }
  });

  it("walks ancestors from nearest to module root", () => {
    expect(getAncestorKeys("documents.workflow.promote")).toEqual([
      "documents.feature.tranzit",
      "documents",
    ]);
  });
});

describe("cascade", () => {
  it("disabling a module disables its whole subtree", () => {
    const overrides: ConfigOverrides = { tenant: { documents: false } };
    expect(isConfigEnabled("documents", overrides)).toBe(false);
    expect(isConfigEnabled("documents.page.module", overrides)).toBe(false);
    expect(isConfigEnabled("documents.section.passport", overrides)).toBe(false);
    expect(isConfigEnabled("documents.workflow.promote", overrides)).toBe(false);
  });

  it("disabling an intermediate feature disables only its own subtree", () => {
    const overrides: ConfigOverrides = { tenant: { "documents.feature.tranzit": false } };
    expect(isConfigEnabled("documents", overrides)).toBe(true);
    expect(isConfigEnabled("documents.workflow.promote", overrides)).toBe(false);
    // A sibling feature is untouched.
    expect(isConfigEnabled("documents.feature.collections", overrides)).toBe(true);
  });

  it("an explicitly enabled child cannot resurrect itself under a disabled parent", () => {
    const overrides: ConfigOverrides = {
      tenant: { documents: false, "documents.action.upload": true },
    };
    expect(isConfigEnabled("documents.action.upload", overrides)).toBe(false);
  });
});

describe("precedence", () => {
  it("company override beats the tenant row", () => {
    const overrides: ConfigOverrides = { tenant: { inventory: true }, company: { inventory: false } };
    expect(isConfigEnabled("inventory", overrides)).toBe(false);
  });

  it("company override can re-enable what the tenant switched off", () => {
    const overrides: ConfigOverrides = { tenant: { inventory: false }, company: { inventory: true } };
    expect(isConfigEnabled("inventory", overrides)).toBe(true);
  });

  it("falls back to the tenant row for keys the company does not override", () => {
    const overrides: ConfigOverrides = { tenant: { crm: false }, company: { inventory: false } };
    expect(isConfigEnabled("crm", overrides)).toBe(false);
  });

  it("company-level parent still cascades to children", () => {
    const overrides: ConfigOverrides = { tenant: {}, company: { documents: false } };
    expect(isConfigEnabled("documents.section.revisions", overrides)).toBe(false);
  });
});

describe("navigation filtering", () => {
  it("reports no disabled routes by default", () => {
    expect(disabledRoutes(none)).toEqual([]);
  });

  it("drops a page route when its module is disabled, so nav has no dead link", () => {
    expect(disabledRoutes({ tenant: { documents: false } })).toContain("/documents");
  });

  it("drops a page route when only that page is disabled", () => {
    const routes = disabledRoutes({ tenant: { "documents.page.module": false } });
    expect(routes).toContain("/documents");
    // Other modules' routes stay available.
    expect(routes).not.toContain("/tasks");
  });
});

describe("navigation integration", () => {
  // The end-to-end guarantee the PRDs actually state: switching a module off
  // must leave no reachable link behind in the sidebar.
  it("removes the sidebar entry for a disabled module's route", () => {
    const sections: NavSection[] = [
      {
        titleKey: "nav.work",
        items: [
          { labelKey: "nav.documents", href: "/documents", icon: FileText, resource: "DOCUMENTS" },
          { labelKey: "nav.tasks", href: "/tasks", icon: FileText, resource: "TASKS" },
        ],
      },
    ];
    const blocked = new Set(disabledRoutes({ tenant: { documents: false } }));

    const visible = visibleNavSections(sections, "OWNER", undefined, blocked);
    const hrefs = visible.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).not.toContain("/documents");
    expect(hrefs).toContain("/tasks");
  });

  it("drops a section entirely when its last item is disabled, leaving no empty heading", () => {
    const sections: NavSection[] = [
      {
        titleKey: "nav.work",
        items: [{ labelKey: "nav.documents", href: "/documents", icon: FileText, resource: "DOCUMENTS" }],
      },
    ];
    const blocked = new Set(disabledRoutes({ tenant: { documents: false } }));
    expect(visibleNavSections(sections, "OWNER", undefined, blocked)).toEqual([]);
  });
});

describe("resolver caching", () => {
  it("returns the same answer as the direct call", () => {
    const overrides: ConfigOverrides = { tenant: { "documents.feature.tranzit": false } };
    const resolve = buildConfigResolver(overrides);
    for (const key of ["documents", "documents.workflow.promote", "documents.feature.collections"]) {
      expect(resolve(key)).toBe(isConfigEnabled(key, overrides));
    }
    // Second read comes from cache and must not drift.
    expect(resolve("documents.workflow.promote")).toBe(false);
  });

  it("treats unknown keys as enabled rather than throwing", () => {
    expect(isConfigEnabled("module.that.does.not.exist", none)).toBe(true);
  });
});
