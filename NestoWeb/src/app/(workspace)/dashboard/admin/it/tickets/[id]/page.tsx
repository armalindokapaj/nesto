import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getConfigResolver } from "@/server/platform-config";
import { getItTicket } from "@/server/it-admin";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TicketStatusActions, AddTicketCommentForm } from "@/components/it-admin/it-admin-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  RESOLVED: "success",
  CLOSED: "neutral",
};

export default async function ItTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role, company } = await getCurrentUser();
  if (!(await getConfigResolver(tenantId, company?.id))("it_admin.page.ticket_detail")) redirect("/dashboard/admin/it/tickets");
  const canManage = can(role, "COMPANY_SETTINGS", "FULL");

  let ticket;
  try {
    ticket = await getItTicket(tenantId, id);
  } catch {
    notFound();
  }
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{ticket.number} — {ticket.title}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t(`itAdmin.ticketType_${ticket.ticketType}`)} · {t(`itAdmin.priority_${ticket.priority}`)}</p>
        </div>
        <Badge tone={STATUS_TONE[ticket.status] ?? "neutral"}>{t(`itAdmin.status_${ticket.status}`)}</Badge>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <p className="text-sm text-ink-muted">{ticket.description ?? "—"}</p>
          <p className="text-xs text-ink-faint">{formatDate(ticket.createdAt)}</p>
          {canManage && <TicketStatusActions ticketId={ticket.id} status={ticket.status} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">{t("itAdmin.comments")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {ticket.comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-border px-3 py-2 text-sm">
              <p className="text-ink">{c.body}</p>
              <p className="text-xs text-ink-faint mt-1">{formatDate(c.createdAt)}</p>
            </div>
          ))}
          {ticket.comments.length === 0 && <p className="text-sm text-ink-faint">{t("itAdmin.noComments")}</p>}
          <AddTicketCommentForm ticketId={ticket.id} />
        </CardContent>
      </Card>
    </div>
  );
}
