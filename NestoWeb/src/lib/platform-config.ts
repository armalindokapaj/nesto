// Platform Configuration — the toggle catalog and resolver.
//
// Mandated by 7 of the 8 module PRDs (Inventory §60, Teams §32, CRM §41,
// Contracts §44, Finance §39, Assets §19, plus Documents' configurable folder
// templates). Every module, page, section, widget, feature, workflow, action
// and report is addressable by a dotted key and can be switched off per tenant
// or per company, and a disabled node must disappear from navigation, search,
// APIs and layouts — "no dead links or blank spaces".
//
// This file is pure (no DB, no `server-only`) so the same resolution logic runs
// in server components, route handlers, action guards and client nav filtering,
// and so it can be unit-tested directly.

export const CONFIG_LEVELS = [
  "MODULE",
  "PAGE",
  "SECTION",
  "WIDGET",
  "FEATURE",
  "WORKFLOW",
  "ACTION",
  "REPORT",
] as const;
export type ConfigLevel = (typeof CONFIG_LEVELS)[number];

export type ConfigNode = {
  key: string;
  label: string;
  level: ConfigLevel;
  /** Dotted key of the parent node. Disabling a parent disables the subtree. */
  parent?: string;
  /** Route this node gates, when it is a PAGE. Used to filter navigation. */
  route?: string;
  /** Default when no override row exists. Everything ships enabled. */
  defaultEnabled?: boolean;
};

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------
// Modules already built out declare their full node tree. Modules not yet
// implemented declare their MODULE node only, so they can be toggled from day
// one and fill in their own pages/sections as they are built.

export const CONFIG_NODES: ConfigNode[] = [
  // --- Documents (PRD_Documents_Module) ------------------------------------
  { key: "documents", label: "Documents", level: "MODULE" },
  { key: "documents.page.module", label: "Documents Module Page", level: "PAGE", parent: "documents", route: "/documents" },
  { key: "documents.page.detail", label: "Document Page", level: "PAGE", parent: "documents" },
  { key: "documents.section.folder_tree", label: "Folder tree", level: "SECTION", parent: "documents.page.module" },
  { key: "documents.section.summary_cards", label: "Status summary cards", level: "SECTION", parent: "documents.page.module" },
  { key: "documents.section.passport", label: "Document Passport panel", level: "SECTION", parent: "documents.page.detail" },
  { key: "documents.section.revisions", label: "Revisions", level: "SECTION", parent: "documents.page.detail" },
  { key: "documents.section.comments", label: "Comments", level: "SECTION", parent: "documents.page.detail" },
  { key: "documents.section.activity", label: "Activity timeline", level: "SECTION", parent: "documents.page.detail" },
  { key: "documents.feature.tranzit", label: "Project Tranzit folder", level: "FEATURE", parent: "documents" },
  { key: "documents.feature.collections", label: "Document collections", level: "FEATURE", parent: "documents" },
  { key: "documents.feature.required_reading", label: "Required reading", level: "FEATURE", parent: "documents" },
  { key: "documents.feature.watermarks", label: "Watermarks", level: "FEATURE", parent: "documents" },
  { key: "documents.feature.dependencies", label: "Dependencies & impact warnings", level: "FEATURE", parent: "documents" },
  { key: "documents.workflow.promote", label: "Promote from Tranzit", level: "WORKFLOW", parent: "documents.feature.tranzit" },
  { key: "documents.action.upload", label: "Upload document", level: "ACTION", parent: "documents" },
  { key: "documents.action.upload_revision", label: "Upload revision", level: "ACTION", parent: "documents" },
  { key: "documents.action.create_shortcut", label: "Create shortcut", level: "ACTION", parent: "documents" },
  { key: "documents.action.archive", label: "Archive / restore", level: "ACTION", parent: "documents" },
  { key: "documents.report.storage", label: "Storage dashboard", level: "REPORT", parent: "documents" },

  // --- Modules pending build ------------------------------------------------
  { key: "tasks", label: "Tasks", level: "MODULE" },
  { key: "tasks.page.module", label: "Tasks Module Page", level: "PAGE", parent: "tasks", route: "/tasks" },
  { key: "teams", label: "Teams", level: "MODULE" },
  { key: "crm", label: "CRM", level: "MODULE" },
  { key: "crm.page.clients", label: "Clients", level: "PAGE", parent: "crm", route: "/clients" },
  { key: "contracts", label: "Contracts", level: "MODULE" },
  { key: "contracts.page.module", label: "Contracts Module Page", level: "PAGE", parent: "contracts", route: "/contracts" },
  { key: "finance", label: "Finance", level: "MODULE" },
  { key: "inventory", label: "Inventory", level: "MODULE" },
  { key: "assets", label: "Assets", level: "MODULE" },
];

const NODE_BY_KEY = new Map(CONFIG_NODES.map((n) => [n.key, n]));

export function getConfigNode(key: string): ConfigNode | undefined {
  return NODE_BY_KEY.get(key);
}

/** Walks parent links to the module root. Nearest ancestor first. */
export function getAncestorKeys(key: string): string[] {
  const chain: string[] = [];
  const seen = new Set<string>([key]);
  let cursor = NODE_BY_KEY.get(key)?.parent;
  while (cursor && !seen.has(cursor)) {
    chain.push(cursor);
    seen.add(cursor);
    cursor = NODE_BY_KEY.get(cursor)?.parent;
  }
  return chain;
}

export type ConfigOverrides = {
  /** Tenant-wide rows: nodeKey -> enabled. */
  tenant: Record<string, boolean>;
  /** Company-specific rows, which win over the tenant row. */
  company?: Record<string, boolean>;
};

/**
 * Effective state of one node.
 *
 * Precedence, nearest wins: company override > tenant override > catalog
 * default (enabled). A node is then disabled if **any ancestor** resolves to
 * disabled — that cascade is what makes "disabled functionality disappears
 * from navigation, search, APIs and layouts" hold without every call site
 * having to check each parent itself.
 */
export function isConfigEnabled(key: string, overrides: ConfigOverrides): boolean {
  const ownState = (k: string): boolean => {
    if (overrides.company && k in overrides.company) return overrides.company[k]!;
    if (k in overrides.tenant) return overrides.tenant[k]!;
    return NODE_BY_KEY.get(k)?.defaultEnabled ?? true;
  };

  if (!ownState(key)) return false;
  for (const ancestor of getAncestorKeys(key)) {
    if (!ownState(ancestor)) return false;
  }
  return true;
}

/** Convenience for building a lookup once and reusing it across a render. */
export function buildConfigResolver(overrides: ConfigOverrides) {
  const cache = new Map<string, boolean>();
  return (key: string) => {
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const value = isConfigEnabled(key, overrides);
    cache.set(key, value);
    return value;
  };
}

export type ConfigResolver = ReturnType<typeof buildConfigResolver>;

/**
 * Routes that must not appear in navigation or resolve in search, given the
 * current overrides. Any PAGE node that is disabled (directly or by cascade)
 * contributes its route.
 */
export function disabledRoutes(overrides: ConfigOverrides): string[] {
  const resolve = buildConfigResolver(overrides);
  return CONFIG_NODES.filter((n) => n.route && !resolve(n.key)).map((n) => n.route!);
}
