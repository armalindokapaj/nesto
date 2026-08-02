import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listContractors } from "@/server/contractors";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateContractorDialog } from "@/components/contractors/create-contractor-dialog";
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

export default async function ContractorsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "COMPANY_NETWORK", "READ")) redirect("/dashboard/executive");
  const canCreate = can(role, "COMPANY_NETWORK", "WRITE");

  const contractors = await listContractors(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("contractors.title")}</CardTitle>
            <CardDescription>{t("contractors.subtitle")}</CardDescription>
          </div>
          {canCreate && <CreateContractorDialog />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("contractors.number")}</TH>
                <TH>{t("common.name")}</TH>
                <TH>{t("contractors.trade")}</TH>
                <TH>{t("contractors.contact")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("contractors.riskRating")}</TH>
              </TRow>
            </THead>
            <TBody>
              {contractors.map((contractor) => (
                <TRow key={contractor.id}>
                  <TD className="font-medium text-ink">{contractor.number}</TD>
                  <TD>
                    <Link href={`/contractors/${contractor.id}`} className="font-medium text-ink hover:text-gold hover:underline">
                      {contractor.name}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{contractor.tradeType}</TD>
                  <TD className="text-ink-muted">{contractor.email ?? contractor.phone ?? "—"}</TD>
                  <TD>
                    <Badge status={contractor.status}>{t(`contractors.${contractor.status.toLowerCase()}`)}</Badge>
                  </TD>
                  <TD>
                    <Badge tone={RISK_TONE[contractor.riskRating] ?? "neutral"}>{t(RISK_KEY[contractor.riskRating] ?? contractor.riskRating)}</Badge>
                  </TD>
                </TRow>
              ))}
              {contractors.length === 0 && (
                <TRow>
                  <TD colSpan={6} className="text-center text-ink-faint py-8">
                    {t("contractors.noContractors")}
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
