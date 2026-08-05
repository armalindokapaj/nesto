import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getConfigCatalogState } from "@/server/platform-config";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ConfigNodeTree } from "@/components/settings/config-node-tree";

// Platform Configuration settings. Every module PRD requires enable/disable at
// module, page, section, widget, feature, workflow, action and report level;
// this is the surface that drives it. Switching a node off cascades to its
// whole subtree and strips the corresponding routes from navigation.
export default async function PlatformConfigurationPage() {
  const { tenantId, role, company } = await getCurrentUser();
  // Configuration is company governance, not per-module access — gate it the
  // same way the toggle action does so the page can't advertise what the
  // action would refuse.
  if (!can(role, "COMPANY_SETTINGS", "FULL")) redirect("/dashboard/executive");

  const nodes = await getConfigCatalogState(tenantId, company?.id);

  // Group by module root so each module reads as one block.
  const groups = nodes.reduce<Record<string, typeof nodes>>((acc, node) => {
    const moduleKey = node.key.split(".")[0]!;
    (acc[moduleKey] ??= []).push(node);
    return acc;
  }, {});

  const disabledCount = nodes.filter((n) => !n.enabled).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Platform Configuration</CardTitle>
            <CardDescription>
              Enable or disable any module, page, section, widget, feature, workflow, action or report.
              Switching off a parent switches off everything beneath it, and disabled pages disappear from
              navigation and search — no dead links.
            </CardDescription>
          </div>
          <span className="shrink-0 text-sm text-ink-muted">
            {nodes.length - disabledCount} of {nodes.length} enabled
          </span>
        </CardHeader>
      </Card>

      {Object.entries(groups).map(([moduleKey, moduleNodes]) => {
        const root = moduleNodes.find((n) => n.level === "MODULE");
        return (
          <Card key={moduleKey}>
            <CardHeader>
              <div>
                <CardTitle>{root?.label ?? moduleKey}</CardTitle>
                <CardDescription>
                  {root && !root.enabled
                    ? "Module disabled — every page, action and report below is switched off with it."
                    : `${moduleNodes.filter((n) => n.enabled).length} of ${moduleNodes.length} enabled`}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ConfigNodeTree nodes={moduleNodes} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
