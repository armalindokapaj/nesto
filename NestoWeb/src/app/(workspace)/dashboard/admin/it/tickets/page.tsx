import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getConfigResolver } from "@/server/platform-config";
import { listItTickets } from "@/server/it-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateTicketDialog } from "@/components/it-admin/it-admin-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  RESOLVED: "success",
  CLOSED: "neutral",
};

export default async function ItTicketsPage() {
  const { tenantId, company } = await getCurrentUser();
  if (!(await getConfigResolver(tenantId, company?.id))("it_admin.page.tickets")) redirect("/dashboard/admin/it");

  const tickets = await listItTickets(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">{t("itAdmin.tickets")}</h1>
        <CreateTicketDialog />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.name")}</TH>
                <TH>{t("itAdmin.ticketType")}</TH>
                <TH>{t("itAdmin.priority")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("common.date")}</TH>
              </TRow>
            </THead>
            <TBody>
              {tickets.map((tk) => (
                <TRow key={tk.id}>
                  <TD><Link href={`/dashboard/admin/it/tickets/${tk.id}`} className="text-ink font-medium hover:text-gold">{tk.number} — {tk.title}</Link></TD>
                  <TD className="text-ink-muted">{t(`itAdmin.ticketType_${tk.ticketType}`)}</TD>
                  <TD className="text-ink-muted">{t(`itAdmin.priority_${tk.priority}`)}</TD>
                  <TD><Badge tone={STATUS_TONE[tk.status] ?? "neutral"}>{t(`itAdmin.status_${tk.status}`)}</Badge></TD>
                  <TD className="text-ink-muted">{formatDate(tk.createdAt)}</TD>
                </TRow>
              ))}
              {tickets.length === 0 && <TRow><TD colSpan={5} className="py-8 text-center text-ink-faint">{t("itAdmin.noTickets")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
