import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listClients } from "@/server/clients";
import { listProjects } from "@/server/projects";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateClientDialog } from "@/components/clients/create-client-dialog";
import { getT } from "@/lib/i18n/server";

export default async function ClientsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "CLIENTS", "READ")) redirect("/dashboard/executive");
  const canCreate = can(role, "CLIENTS", "FULL");

  const [clients, projects] = await Promise.all([listClients(tenantId), listProjects(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          href="/clients/leads"
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          {t("crm.leadsTitle")}
        </Link>
        <Link
          href="/clients/pipeline"
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          {t("crm.pipelineTitle")}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("clients.title")}</CardTitle>
            <CardDescription>{t("clients.subtitle")}</CardDescription>
          </div>
          {canCreate && <CreateClientDialog projects={projects.map((p) => ({ id: p.id, name: p.name }))} />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("clients.name")}</TH>
                <TH>{t("crm.clientType")}</TH>
                <TH>{t("common.email")}</TH>
                <TH>{t("nav.projects")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("crm.owner")}</TH>
              </TRow>
            </THead>
            <TBody>
              {clients.map((client) => (
                <TRow key={client.id}>
                  <TD>
                    <Link href={`/clients/${client.id}`} className="font-medium text-ink hover:text-gold hover:underline">
                      {client.name}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{client.clientType ?? "—"}</TD>
                  <TD className="text-ink-muted">{client.email ?? "—"}</TD>
                  <TD className="text-ink-muted">{client._count.projects}</TD>
                  <TD>
                    <Badge status={client.status}>{t(`clients.${client.status.toLowerCase()}`)}</Badge>
                  </TD>
                  <TD className="text-ink-muted">{client.owner?.displayName ?? "—"}</TD>
                </TRow>
              ))}
              {clients.length === 0 && (
                <TRow>
                  <TD colSpan={6} className="text-center text-ink-faint py-8">
                    {t("clients.noClients")}
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
