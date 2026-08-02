import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listAuditEvents } from "@/server/admin";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function AdminAuditPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "AUDIT_LOGS", "READ")) redirect("/dashboard/executive");

  const events = await listAuditEvents(tenantId, 100);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("admin_sub.auditTitle")}</CardTitle>
            <CardDescription>{t("admin_sub.auditSubtitle")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.actions")}</TH>
                <TH>{t("dashboards.admin.joined")}</TH>
              </TRow>
            </THead>
            <TBody>
              {events.map((event) => (
                <TRow key={event.id}>
                  <TD className="text-ink">{event.action.replaceAll("_", " ")}</TD>
                  <TD className="text-ink-muted">
                    {formatDate(event.createdAt, { hour: "2-digit", minute: "2-digit" })}
                  </TD>
                </TRow>
              ))}
              {events.length === 0 && (
                <TRow>
                  <TD colSpan={2} className="text-center text-ink-faint py-8">
                    {t("admin_sub.noAuditEvents")}
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
