import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listLeads } from "@/server/crm-module";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { CreateLeadDialog } from "@/components/clients/create-lead-dialog";
import { LeadRowActions } from "@/components/clients/lead-row-actions";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "CLIENTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "CLIENTS", "WRITE");
  const params = await searchParams;

  const leads = await listLeads(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("clients.title")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("crm.leadsTitle")}</CardTitle>
            <CardDescription>{t("crm.leadsSubtitle")}</CardDescription>
          </div>
          {canWrite && <CreateLeadDialog defaultOpen={params.open === "create"} />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("crm.leadTitle")}</TH>
                <TH>{t("crm.source")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("crm.estimatedValue")}</TH>
                <TH>{t("crm.owner")}</TH>
                <TH>{t("dashboards.admin.joined")}</TH>
                <TH></TH>
              </TRow>
            </THead>
            <TBody>
              {leads.map((lead) => (
                <TRow key={lead.id}>
                  <TD className="font-medium text-ink">
                    {lead.client ? (
                      <Link href={`/clients/${lead.client.id}`} className="hover:text-gold hover:underline">
                        {lead.title}
                      </Link>
                    ) : (
                      lead.title
                    )}
                    {lead.personName && <p className="text-xs text-ink-faint">{lead.personName}</p>}
                  </TD>
                  <TD className="text-ink-muted">{lead.source ?? "—"}</TD>
                  <TD>
                    <Badge tone={lead.status === "LOST" ? "danger" : lead.status === "CONVERTED" ? "success" : "neutral"}>
                      {t(`crm.leadStatus_${lead.status}`)}
                    </Badge>
                  </TD>
                  <TD className="text-ink-muted">{lead.estimatedValue != null ? `€${lead.estimatedValue.toLocaleString()}` : "—"}</TD>
                  <TD className="text-ink-muted">
                    {lead.owner ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Avatar name={lead.owner.displayName} color={lead.owner.avatarColor ?? undefined} size={20} />
                        {lead.owner.displayName}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD className="text-ink-muted">{formatDate(lead.createdAt)}</TD>
                  <TD>
                    <LeadRowActions leadId={lead.id} status={lead.status} canWrite={canWrite} />
                  </TD>
                </TRow>
              ))}
              {leads.length === 0 && (
                <TRow>
                  <TD colSpan={7} className="py-8 text-center text-ink-faint">
                    {t("crm.noLeads")}
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
