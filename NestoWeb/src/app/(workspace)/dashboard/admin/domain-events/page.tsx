import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listStuckDomainEvents } from "@/server/admin";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RetryDomainEventButton } from "@/components/dashboards/admin/retry-domain-event-button";
import { formatDate } from "@/lib/utils";

// Phase 1 Track D — the outbox had no failure surface at all: a FAILED event
// sat in the table until somebody thought to look. No worker, no queue, no
// scheduled sweep — a list and a retry button, which is what this actually
// needs until there is a second real workflow using the outbox.
export default async function DomainEventsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "AUDIT_LOGS", "READ")) redirect("/dashboard/executive");
  const canRetry = can(role, "USER_MANAGEMENT", "FULL");

  const events = await listStuckDomainEvents(tenantId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Domain events</CardTitle>
            <CardDescription>
              Events waiting to be processed, or that failed. A processed event drops off this list.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>Type</TH>
                <TH>Status</TH>
                <TH>Error</TH>
                <TH>Raised</TH>
                <TH>Correlation</TH>
                {canRetry && <TH className="text-right">Actions</TH>}
              </TRow>
            </THead>
            <TBody>
              {events.map((e) => (
                <TRow key={e.id}>
                  <TD className="font-medium text-ink">{e.type}</TD>
                  <TD>
                    <Badge status={e.status}>{e.status}</Badge>
                  </TD>
                  <TD className="text-ink-muted max-w-md truncate" title={e.error ?? undefined}>
                    {e.error ?? "—"}
                  </TD>
                  <TD className="text-ink-muted">{formatDate(e.createdAt)}</TD>
                  <TD className="text-ink-faint font-mono text-xs">{e.correlationId ?? "—"}</TD>
                  {canRetry && (
                    <TD className="text-right">
                      <RetryDomainEventButton eventId={e.id} />
                    </TD>
                  )}
                </TRow>
              ))}
              {events.length === 0 && (
                <TRow>
                  <TD colSpan={canRetry ? 6 : 5} className="text-center text-ink-faint py-8">
                    Nothing stuck — every domain event has been processed.
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
