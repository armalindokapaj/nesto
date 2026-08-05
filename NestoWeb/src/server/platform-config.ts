import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import {
  CONFIG_NODES,
  buildConfigResolver,
  disabledRoutes,
  getAncestorKeys,
  type ConfigOverrides,
  type ConfigResolver,
} from "@/lib/platform-config";

// Platform Configuration — server side. Loads the tenant's (and optionally the
// active company's) override rows and hands back a resolver. Cached per request
// with React's `cache` so a page that gates twenty sections issues one query.

/** Sentinel in `PlatformConfigSetting.scope` marking a tenant-wide row. */
export const TENANT_SCOPE = "TENANT";

export const loadConfigOverrides = cache(
  async (tenantId: string, companyId?: string | null): Promise<ConfigOverrides> => {
    const rows = await db.platformConfigSetting.findMany({
      where: { tenantId, OR: [{ companyId: null }, ...(companyId ? [{ companyId }] : [])] },
      select: { nodeKey: true, enabled: true, companyId: true },
    });

    const tenant: Record<string, boolean> = {};
    const company: Record<string, boolean> = {};
    for (const row of rows) {
      if (row.companyId) company[row.nodeKey] = row.enabled;
      else tenant[row.nodeKey] = row.enabled;
    }
    return { tenant, company };
  }
);

/** Request-scoped resolver. `resolve("documents.action.upload")` -> boolean. */
export async function getConfigResolver(tenantId: string, companyId?: string | null): Promise<ConfigResolver> {
  return buildConfigResolver(await loadConfigOverrides(tenantId, companyId));
}

/**
 * API/action guard. Every write path a PRD marks configurable calls this, so a
 * disabled feature is unreachable through the API and not merely hidden in the
 * UI (the PRDs require disabled items to vanish from APIs too).
 */
export async function assertConfigEnabled(
  tenantId: string,
  nodeKey: string,
  companyId?: string | null
): Promise<void> {
  const resolve = await getConfigResolver(tenantId, companyId);
  if (!resolve(nodeKey)) {
    throw new Error("This feature is disabled for your organisation.");
  }
}

/** Routes to strip from navigation and search results. */
export async function getDisabledRoutes(tenantId: string, companyId?: string | null): Promise<string[]> {
  return disabledRoutes(await loadConfigOverrides(tenantId, companyId));
}

/** Full catalog with current effective state — powers the settings screen. */
export async function getConfigCatalogState(tenantId: string, companyId?: string | null) {
  const overrides = await loadConfigOverrides(tenantId, companyId);
  const resolve = buildConfigResolver(overrides);

  const ownState = (key: string): boolean => {
    if (overrides.company && key in overrides.company) return overrides.company[key]!;
    if (key in overrides.tenant) return overrides.tenant[key]!;
    return true;
  };

  return CONFIG_NODES.map((node) => {
    const enabled = resolve(node.key);
    return {
      ...node,
      enabled,
      // Distinguishes "off because someone switched this off" from "off because
      // an ancestor is off", so the settings UI can explain why rather than
      // offering a toggle that would appear to do nothing.
      explicitlySet: (overrides.company && node.key in overrides.company) || node.key in overrides.tenant,
      inheritedOff: !enabled && ownState(node.key),
      depth: getAncestorKeys(node.key).length,
    };
  });
}

export async function setConfigNodeEnabled(input: {
  tenantId: string;
  companyId?: string | null;
  nodeKey: string;
  enabled: boolean;
  updatedById: string;
}) {
  const { tenantId, companyId = null, nodeKey, enabled, updatedById } = input;
  if (!CONFIG_NODES.some((n) => n.key === nodeKey)) {
    throw new Error(`Unknown configuration node: ${nodeKey}`);
  }

  return db.platformConfigSetting.upsert({
    where: { tenantId_scope_nodeKey: { tenantId, scope: companyId ?? TENANT_SCOPE, nodeKey } },
    create: { tenantId, companyId, scope: companyId ?? TENANT_SCOPE, nodeKey, enabled, updatedById },
    update: { enabled, updatedById },
  });
}

/** Clearing an override returns the node to inheriting from its parent. */
export async function clearConfigOverride(input: {
  tenantId: string;
  companyId?: string | null;
  nodeKey: string;
}) {
  const { tenantId, companyId = null, nodeKey } = input;
  await db.platformConfigSetting.deleteMany({ where: { tenantId, scope: companyId ?? TENANT_SCOPE, nodeKey } });
}
