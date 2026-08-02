import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listAllMembers } from "@/server/admin";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CreateUserDialog } from "@/components/dashboards/admin/create-user-dialog";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function AdminUsersPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "USER_MANAGEMENT", "READ")) redirect("/dashboard/executive");
  const canCreate = can(role, "USER_MANAGEMENT", "FULL");

  const members = await listAllMembers(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("admin_sub.usersTitle")}</CardTitle>
            <CardDescription>{t("admin_sub.usersSubtitle")}</CardDescription>
          </div>
          {canCreate && <CreateUserDialog />}
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
              {members.map((m) => (
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
              {members.length === 0 && (
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
    </div>
  );
}
