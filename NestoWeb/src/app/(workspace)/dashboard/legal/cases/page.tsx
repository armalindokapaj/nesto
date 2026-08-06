import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listLegalCases, listProjectsForPicker } from "@/server/legal";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateCaseDialog } from "@/components/legal/legal-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  OPEN: "info",
  IN_PROGRESS: "info",
  ON_HOLD: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
};

export default async function LegalCasesPage() {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "LEGAL", "READ")) redirect("/dashboard/executive");
  const canManage = can(role, "LEGAL", "WRITE");

  const [cases, projects] = await Promise.all([
    listLegalCases(tenantId, { userId: user.id, role }),
    listProjectsForPicker(tenantId),
  ]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("legal.casesTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("legal.casesSubtitle")}</p>
        </div>
        {canManage && <CreateCaseDialog projects={projects} />}
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("legal.caseNumber")}</TH>
                <TH>{t("legal.caseTitle")}</TH>
                <TH>{t("legal.caseType")}</TH>
                <TH>{t("legal.confidentialityTier")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("common.date")}</TH>
              </TRow>
            </THead>
            <TBody>
              {cases.map((c) => (
                <TRow key={c.id}>
                  <TD className="text-ink font-medium">
                    <Link href={`/dashboard/legal/cases/${c.id}`} className="hover:text-gold">{c.caseNumber}</Link>
                  </TD>
                  <TD className="text-ink-muted">{c.title}</TD>
                  <TD className="text-ink-muted">{t(`legal.caseType_${c.caseType}`)}</TD>
                  <TD className="text-ink-muted">{t(`legal.tier_${c.confidentialityTier}`)}</TD>
                  <TD><Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{t(`legal.caseStatus_${c.status}`)}</Badge></TD>
                  <TD className="text-ink-muted">{formatDate(c.openedAt)}</TD>
                </TRow>
              ))}
              {cases.length === 0 && <TRow><TD colSpan={6} className="py-8 text-center text-ink-faint">{t("legal.noCases")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
