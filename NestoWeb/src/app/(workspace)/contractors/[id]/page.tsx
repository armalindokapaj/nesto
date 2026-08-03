import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getContractor } from "@/server/contractors";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ContractorFinancialForm } from "@/components/contractors/contractor-financial-form";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const RISK_KEY: Record<string, string> = {
  LOW: "contractors.low",
  MEDIUM: "contractors.medium",
  HIGH: "contractors.high",
};

const RISK_TONE: Record<string, "success" | "warning" | "danger"> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "danger",
};

export default async function ContractorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "COMPANY_NETWORK", "READ")) redirect("/dashboard/executive");

  const contractor = await getContractor(tenantId, id);
  const { t } = await getT();
  const canEdit = can(role, "COMPANY_NETWORK", "WRITE");

  const activeContracts = contractor.contracts.filter((c) => c.status === "ACTIVE");

  return (
    <div className="space-y-6">
      <Link href="/contractors" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> {t("contractors.title")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle>{contractor.name}</CardTitle>
              <Badge status={contractor.status}>{t(`contractors.${contractor.status.toLowerCase()}`)}</Badge>
              <Badge tone={RISK_TONE[contractor.riskRating] ?? "neutral"}>
                {t(RISK_KEY[contractor.riskRating] ?? contractor.riskRating)}
              </Badge>
            </div>
            <CardDescription>
              {contractor.number} · {contractor.tradeType}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-ink-muted flex items-center gap-1.5">
                <Mail size={13} /> {t("common.email")}
              </p>
              <p className="text-sm font-medium text-ink mt-1">{contractor.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted flex items-center gap-1.5">
                <Phone size={13} /> {t("contractors.contact")}
              </p>
              <p className="text-sm font-medium text-ink mt-1">{contractor.phone ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">{t("contractors.activeContracts")}</p>
              <p className="text-sm font-medium text-ink mt-1">{activeContracts.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("contractors.financialDetailsTitle")}</CardTitle>
            <CardDescription>{t("contractors.financialDetailsSubtitle")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <ContractorFinancialForm contractorId={contractor.id} taxId={contractor.taxId} bankAccount={contractor.bankAccount} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-ink-muted">{t("contractors.taxId")}</p>
                <p className="text-sm font-medium text-ink mt-1">{contractor.taxId ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">{t("contractors.bankAccount")}</p>
                <p className="text-sm font-medium text-ink mt-1">{contractor.bankAccount ?? "—"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("contractors.contractsTitle")}</CardTitle>
            <CardDescription>{t("contractors.contractsSubtitle")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("contracts.number")}</TH>
                <TH>{t("task.title")}</TH>
                <TH>{t("common.project")}</TH>
                <TH>{t("contracts.value")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("contracts.startDate")}</TH>
                <TH>{t("contracts.endDate")}</TH>
              </TRow>
            </THead>
            <TBody>
              {contractor.contracts.map((contract) => (
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
                  <TD className="text-ink-muted">{formatCurrency(contract.value, contract.currency)}</TD>
                  <TD>
                    <Badge status={contract.status}>{t(`contracts.${contract.status.toLowerCase()}`)}</Badge>
                  </TD>
                  <TD className="text-ink-muted">{contract.startDate ? formatDate(contract.startDate) : "—"}</TD>
                  <TD className="text-ink-muted">{contract.endDate ? formatDate(contract.endDate) : "—"}</TD>
                </TRow>
              ))}
              {contractor.contracts.length === 0 && (
                <TRow>
                  <TD colSpan={7} className="text-center text-ink-faint py-8">
                    {t("contractors.noContractsYet")}
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
