import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listSupportCases } from "@/server/crm-module";
import { listClients } from "@/server/clients";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateSupportCaseDialog } from "@/components/clients/create-support-case-dialog";
import { SupportCaseStatusSelect } from "@/components/clients/support-case-status-select";
import { getT } from "@/lib/i18n/server";

// PRD_Sales_Dashboard §6 — After Sales > Support.
export default async function SupportPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "CLIENTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "CLIENTS", "WRITE");
  const params = await searchParams;

  const [cases, clients] = await Promise.all([listSupportCases(tenantId), listClients(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("clients.title")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("crm.supportTitle")}</CardTitle>
            <CardDescription>{t("crm.supportSubtitle")}</CardDescription>
          </div>
          {canWrite && (
            <CreateSupportCaseDialog clients={clients.map((c) => ({ id: c.id, name: c.name }))} defaultOpen={params.open === "create"} />
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("crm.subject")}</TH>
                <TH>{t("nav.clients")}</TH>
                <TH>{t("crm.priority")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("crm.assignedTo")}</TH>
              </TRow>
            </THead>
            <TBody>
              {cases.map((c) => (
                <TRow key={c.id}>
                  <TD className="font-medium text-ink">{c.subject}</TD>
                  <TD className="text-ink-muted">
                    <Link href={`/clients/${c.client.id}`} className="hover:text-gold hover:underline">
                      {c.client.name}
                    </Link>
                  </TD>
                  <TD>
                    <Badge tone={c.priority === "URGENT" ? "danger" : c.priority === "HIGH" ? "warning" : "neutral"}>{c.priority}</Badge>
                  </TD>
                  <TD>{canWrite ? <SupportCaseStatusSelect caseId={c.id} status={c.status} /> : <Badge status={c.status}>{c.status}</Badge>}</TD>
                  <TD className="text-ink-muted">{c.assignedTo?.displayName ?? "—"}</TD>
                </TRow>
              ))}
              {cases.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="py-8 text-center text-ink-faint">
                    {t("crm.noSupportCasesYet")}
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
