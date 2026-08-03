import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listContracts } from "@/server/contracts";
import { listContractors } from "@/server/contractors";
import { listProjects } from "@/server/projects";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateContractDialog } from "@/components/contracts/create-contract-dialog";
import { ContractActions } from "@/components/contracts/contract-actions";
import { CreateContractorDialog } from "@/components/contractors/create-contractor-dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function ContractsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "CONTRACTS", "READ")) redirect("/dashboard/executive");
  const canCreate = can(role, "CONTRACTS", "WRITE");
  const canCreateContractor = can(role, "COMPANY_NETWORK", "WRITE");
  const canApprove = can(role, "CONTRACTS", "FULL");

  const [contracts, contractors, projects] = await Promise.all([
    listContracts(tenantId),
    listContractors(tenantId),
    listProjects(tenantId),
  ]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("contracts.title")}</CardTitle>
            <CardDescription>{t("contracts.subtitle")}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {canCreateContractor && <CreateContractorDialog />}
            {canCreate && (
              <CreateContractDialog
                projects={projects.map((p) => ({ id: p.id, name: p.name }))}
                contractors={contractors.map((c) => ({ id: c.id, name: c.name }))}
                canCreateContractor={canCreateContractor}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("contracts.number")}</TH>
                <TH>{t("task.title")}</TH>
                <TH>{t("common.project")}</TH>
                <TH>{t("contractors.title")}</TH>
                <TH>{t("contracts.value")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("contracts.endDate")}</TH>
                {canApprove && <TH>{t("common.actions")}</TH>}
              </TRow>
            </THead>
            <TBody>
              {contracts.map((contract) => (
                <TRow key={contract.id}>
                  <TD className="font-medium text-ink">{contract.number}</TD>
                  <TD className="text-ink-muted">{contract.title}</TD>
                  <TD className="text-ink-muted">
                    {contract.project ? (
                      <Link href={`/projects/${contract.project.id}`} className="hover:text-gold hover:underline">
                        {contract.project.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD className="text-ink-muted">
                    {contract.contractor ? (
                      <Link href={`/contractors/${contract.contractor.id}`} className="hover:text-gold hover:underline">
                        {contract.contractor.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD className="text-ink-muted">{formatCurrency(contract.value, contract.currency)}</TD>
                  <TD>
                    <Badge status={contract.status}>{t(`contracts.${contract.status.toLowerCase()}`)}</Badge>
                  </TD>
                  <TD className="text-ink-muted">{contract.endDate ? formatDate(contract.endDate) : "—"}</TD>
                  {canApprove && (
                    <TD>
                      <ContractActions contractId={contract.id} status={contract.status} />
                    </TD>
                  )}
                </TRow>
              ))}
              {contracts.length === 0 && (
                <TRow>
                  <TD colSpan={canApprove ? 8 : 7} className="text-center text-ink-faint py-8">
                    {t("contracts.noContracts")}
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
