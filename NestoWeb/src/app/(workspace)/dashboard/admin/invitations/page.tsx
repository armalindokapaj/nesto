import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listAllInvitations } from "@/server/admin";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InvitationActions } from "@/components/admin/invitation-actions";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function AdminInvitationsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "USER_MANAGEMENT", "READ")) redirect("/dashboard/executive");
  const canManage = can(role, "USER_MANAGEMENT", "FULL");

  const invitations = await listAllInvitations(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("admin_sub.invitationsTitle")}</CardTitle>
            <CardDescription>{t("admin_sub.invitationsSubtitle")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.name")}</TH>
                <TH>{t("common.role")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("admin_sub.invitedOn")}</TH>
                {canManage && <TH>{t("common.actions")}</TH>}
              </TRow>
            </THead>
            <TBody>
              {invitations.map((inv) => (
                <TRow key={inv.id}>
                  <TD className="font-medium text-ink">{inv.email}</TD>
                  <TD>
                    <Badge tone="info">{ROLE_LABELS[inv.role as Role]}</Badge>
                  </TD>
                  <TD>
                    <Badge status={inv.status}>{inv.status}</Badge>
                  </TD>
                  <TD className="text-ink-muted">{formatDate(inv.invitedAt)}</TD>
                  {canManage && (
                    <TD>{inv.status === "PENDING" && <InvitationActions invitationId={inv.id} />}</TD>
                  )}
                </TRow>
              ))}
              {invitations.length === 0 && (
                <TRow>
                  <TD colSpan={canManage ? 5 : 4} className="text-center text-ink-faint py-8">
                    {t("admin_sub.noInvitations")}
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
