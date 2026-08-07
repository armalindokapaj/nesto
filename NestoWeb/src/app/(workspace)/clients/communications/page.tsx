import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listCommunications } from "@/server/crm-module";
import { listClients } from "@/server/clients";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { LogCommunicationDialog } from "@/components/clients/log-communication-dialog";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// PRD_Sales_Dashboard §6/§17 — CRM communication log (Work > Communications).
export default async function CommunicationsPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "CLIENTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "CLIENTS", "WRITE");
  const params = await searchParams;

  const [communications, clients] = await Promise.all([listCommunications(tenantId), listClients(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("clients.title")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("crm.communicationsTitle")}</CardTitle>
            <CardDescription>{t("crm.communicationsSubtitle")}</CardDescription>
          </div>
          {canWrite && (
            <LogCommunicationDialog clients={clients.map((c) => ({ id: c.id, name: c.name }))} defaultOpen={params.open === "create"} />
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.date")}</TH>
                <TH>{t("nav.clients")}</TH>
                <TH>{t("crm.channel")}</TH>
                <TH>{t("crm.subject")}</TH>
                <TH>{t("crm.owner")}</TH>
              </TRow>
            </THead>
            <TBody>
              {communications.map((c) => (
                <TRow key={c.id}>
                  <TD className="text-ink-muted whitespace-nowrap">{formatDate(c.occurredAt)}</TD>
                  <TD className="font-medium text-ink">
                    <Link href={`/clients/${c.client.id}`} className="hover:text-gold hover:underline">
                      {c.client.name}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{c.channel}</TD>
                  <TD className="text-ink-muted">
                    {c.subject ?? "—"}
                    <p className="text-xs text-ink-faint truncate max-w-xs">{c.notes}</p>
                  </TD>
                  <TD className="text-ink-muted">{c.loggedBy.displayName}</TD>
                </TRow>
              ))}
              {communications.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="py-8 text-center text-ink-faint">
                    {t("crm.noCommunicationsYet")}
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
