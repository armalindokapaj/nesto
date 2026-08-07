import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listOpportunities } from "@/server/crm-module";
import { listClients } from "@/server/clients";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { CreateOpportunityDialog } from "@/components/clients/create-opportunity-dialog";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// PRD_Sales_Dashboard §6/§11 — standalone Opportunities register, distinct
// from the per-client list on the Client Page and the stage board on
// Sales Pipeline.
export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "CLIENTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "CLIENTS", "WRITE");
  const params = await searchParams;

  const [opportunities, clients] = await Promise.all([listOpportunities(tenantId), listClients(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("clients.title")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("crm.opportunitiesTitle")}</CardTitle>
            <CardDescription>{t("crm.opportunitiesSubtitleAll")}</CardDescription>
          </div>
          {canWrite && (
            <CreateOpportunityDialog clients={clients.map((c) => ({ id: c.id, name: c.name }))} defaultOpen={params.open === "create"} />
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("crm.opportunityTitle")}</TH>
                <TH>{t("nav.clients")}</TH>
                <TH>{t("crm.stage")}</TH>
                <TH>{t("crm.estimatedValue")}</TH>
                <TH>{t("crm.owner")}</TH>
              </TRow>
            </THead>
            <TBody>
              {opportunities.map((o) => (
                <TRow key={o.id}>
                  <TD className="font-medium text-ink">{o.title}</TD>
                  <TD className="text-ink-muted">
                    <Link href={`/clients/${o.client.id}`} className="hover:text-gold hover:underline">
                      {o.client.name}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{o.stage.name}</TD>
                  <TD className="text-ink-muted">{o.estimatedValue != null ? formatCurrency(o.estimatedValue) : "—"}</TD>
                  <TD className="text-ink-muted">
                    {o.owner ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Avatar name={o.owner.displayName} color={o.owner.avatarColor ?? undefined} size={20} />
                        {o.owner.displayName}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TD>
                </TRow>
              ))}
              {opportunities.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="py-8 text-center text-ink-faint">
                    {t("crm.noOpportunities")}
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
