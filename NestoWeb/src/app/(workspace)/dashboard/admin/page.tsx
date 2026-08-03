import { Users, UserCog, FolderKanban, ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { getAdminDashboardData } from "@/server/admin";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DonutChart } from "@/components/ui/charts/donut-chart";
import { CreateUserDialog } from "@/components/dashboards/admin/create-user-dialog";
import { DashboardGreeting } from "@/components/dashboards/dashboard-greeting";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function AdminDashboardPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "USER_MANAGEMENT", "READ")) redirect("/dashboard/executive");

  const data = await getAdminDashboardData(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <DashboardGreeting greetingRole="ADMIN" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t("dashboards.admin.totalUsers")} value={String(data.totalUsers)} icon={Users} iconColor="#2457C5" iconBg="#E4ECFB" helper={t("dashboards.admin.licensedMembers")} href="/dashboard/admin/users" />
        <StatTile label={t("dashboards.admin.architects")} value={String(data.architectCount)} icon={UserCog} iconColor="#1A7F4E" iconBg="#E2F4EA" helper={t("dashboards.admin.designDepartment")} href="/dashboard/admin/roles" />
        <StatTile label={t("dashboards.admin.activeProjects")} value={String(data.projectCount)} icon={FolderKanban} iconColor="#4a3aa7" iconBg="#EEEAFB" helper={t("dashboards.admin.acrossTeams")} href="/projects" />
        <StatTile label={t("dashboards.admin.pendingInvitations")} value={String(data.pendingInvitations.length)} icon={ShieldAlert} iconColor="#B76E00" iconBg="#FBECD2" helper={t("dashboards.admin.awaitingAcceptance")} href="/dashboard/admin/invitations" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>{t("dashboards.admin.usersTitle")}</CardTitle>
              <CardDescription>{t("dashboards.admin.usersSubtitle")}</CardDescription>
            </div>
            <CreateUserDialog />
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TRow>
                  <TH>{t("common.name")}</TH>
                  <TH>{t("common.role")}</TH>
                  <TH>{t("common.department")}</TH>
                  <TH>{t("common.status")}</TH>
                  <TH>{t("dashboards.admin.joined")}</TH>
                </TRow>
              </THead>
              <TBody>
                {data.recentMembers.map((m) => (
                  <TRow key={m.id}>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={m.user.displayName} color={m.user.avatarColor} size={28} />
                        <div className="min-w-0">
                          <p className="font-medium text-ink truncate">{m.user.displayName}</p>
                          <p className="text-xs text-ink-muted truncate">{m.user.email}</p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <Badge tone="info">{ROLE_LABELS[m.role as Role]}</Badge>
                    </TD>
                    <TD className="text-ink-muted">{m.department ?? "—"}</TD>
                    <TD>
                      <Badge status={m.accessMode}>{m.accessMode === "STANDARD" ? "Active" : m.accessMode.replace("_", " ")}</Badge>
                    </TD>
                    <TD className="text-ink-muted">{formatDate(m.createdAt)}</TD>
                  </TRow>
                ))}
                {data.recentMembers.length === 0 && (
                  <TRow>
                    <TD colSpan={5} className="text-center text-ink-faint py-8">
                      {t("dashboards.admin.noMembers")}
                    </TD>
                  </TRow>
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboards.admin.rolesOverview")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.roleBreakdown.length > 0 ? (
              <DonutChart data={data.roleBreakdown.map((r) => ({ label: ROLE_LABELS[r.label as Role], value: r.value }))} />
            ) : (
              <p className="text-sm text-ink-faint py-8 text-center">{t("dashboards.admin.noRoles")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>{t("dashboards.admin.pendingInvitationsTitle")}</CardTitle>
              <CardDescription>{t("dashboards.admin.pendingInvitationsSubtitle")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {data.pendingInvitations.length === 0 ? (
              <p className="text-sm text-ink-faint py-6 text-center">{t("dashboards.admin.noInvitations")}</p>
            ) : (
              <ul className="space-y-3">
                {data.pendingInvitations.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-ink truncate">{inv.email}</p>
                      <p className="text-xs text-ink-muted">{t("dashboards.admin.sent")} {formatDate(inv.invitedAt)} · {ROLE_LABELS[inv.role as Role]}</p>
                    </div>
                    <Badge tone="warning">{t("dashboards.admin.pending")}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboards.admin.recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentAudit.length === 0 ? (
              <p className="text-sm text-ink-faint py-6 text-center">{t("dashboards.admin.noActivity")}</p>
            ) : (
              <ul className="space-y-3">
                {data.recentAudit.map((event) => (
                  <li key={event.id} className="text-sm">
                    <p className="text-ink">{event.action.replaceAll("_", " ")}</p>
                    <p className="text-xs text-ink-faint">{formatDate(event.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
