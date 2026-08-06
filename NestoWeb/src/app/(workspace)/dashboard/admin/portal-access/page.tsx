import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getConfigResolver } from "@/server/platform-config";
import { listExternalOrganizations } from "@/server/portal-access";
import { listTenantUsersForPicker, listProjectsForPicker } from "@/server/hse";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CreateOrgDialog,
  AddMemberForm,
  RemoveMemberButton,
  GrantProjectAccessForm,
  RevokeAccessButton,
} from "@/components/portal-access/portal-access-dialogs";
import { getT } from "@/lib/i18n/server";

export default async function PortalAccessAdminPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "COMPANY_SETTINGS", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("portal_access.page.admin")) redirect("/dashboard/executive");
  const canManage = can(role, "COMPANY_SETTINGS", "FULL");

  const [orgs, users, projects] = await Promise.all([
    listExternalOrganizations(tenantId),
    listTenantUsersForPicker(tenantId),
    listProjectsForPicker(tenantId),
  ]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("portalAccess.title")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("portalAccess.subtitle")}</p>
        </div>
        {canManage && <CreateOrgDialog />}
      </div>

      {orgs.length === 0 && (
        <Card><CardContent className="py-8 text-center text-ink-faint">{t("portalAccess.noOrgs")}</CardContent></Card>
      )}

      <div className="space-y-4">
        {orgs.map((org) => (
          <Card key={org.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {org.name}
                    <Badge tone={org.orgType === "CLIENT" ? "info" : "neutral"}>{t(`portalAccess.orgType_${org.orgType}`)}</Badge>
                    <Badge tone={org.status === "ACTIVE" ? "success" : "warning"}>{org.status}</Badge>
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <CardDescription className="mb-2">{t("portalAccess.members")}</CardDescription>
                <ul className="space-y-1.5">
                  {org.memberships.map((m) => (
                    <li key={m.id} className="flex items-center justify-between text-sm">
                      <span className="text-ink">{m.user.displayName} <span className="text-ink-faint">({m.portalRole})</span></span>
                      {canManage && <RemoveMemberButton membershipId={m.id} />}
                    </li>
                  ))}
                  {org.memberships.length === 0 && <li className="text-sm text-ink-faint">{t("portalAccess.noMembers")}</li>}
                </ul>
                {canManage && <div className="mt-2"><AddMemberForm externalOrgId={org.id} users={users} /></div>}
              </div>

              <div className="pt-4 border-t border-border">
                <CardDescription className="mb-2">{t("portalAccess.projectAccess")}</CardDescription>
                <ul className="space-y-1.5">
                  {org.accessGrants.map((g) => (
                    <li key={g.id} className="flex items-center justify-between text-sm">
                      <span className="text-ink">{g.project.code} — {g.project.name}</span>
                      {canManage && <RevokeAccessButton accessId={g.id} />}
                    </li>
                  ))}
                  {org.accessGrants.length === 0 && <li className="text-sm text-ink-faint">{t("portalAccess.noAccess")}</li>}
                </ul>
                {canManage && <div className="mt-2"><GrantProjectAccessForm externalOrgId={org.id} projects={projects} /></div>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
