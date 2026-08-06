import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getConfigResolver } from "@/server/platform-config";
import { listVacancies } from "@/server/recruitment";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateVacancyDialog } from "@/components/recruitment/recruitment-dialogs";
import { getT } from "@/lib/i18n/server";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  OPEN: "success",
  ON_HOLD: "warning",
  FILLED: "info",
  CANCELLED: "neutral",
};

export default async function RecruitmentPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("hr.page.recruitment")) redirect("/dashboard/hr");
  const canManage = can(role, "HR", "WRITE");

  const vacancies = await listVacancies(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("hr_sub.recruitmentTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("hr_sub.recruitmentSubtitle")}</p>
        </div>
        {canManage && <CreateVacancyDialog />}
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("recruitment.vacancyTitle")}</TH>
                <TH>{t("common.department")}</TH>
                <TH>{t("recruitment.headcount")}</TH>
                <TH>{t("recruitment.candidates")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {vacancies.map((v) => (
                <TRow key={v.id}>
                  <TD className="text-ink font-medium">
                    <Link href={`/dashboard/hr/recruitment/${v.id}`} className="hover:text-gold">{v.title}</Link>
                  </TD>
                  <TD className="text-ink-muted">{v.department ?? "—"}</TD>
                  <TD className="text-ink-muted">{v.headcount}</TD>
                  <TD className="text-ink-muted">{v.candidateCount} ({v.hiredCount} {t("recruitment.stage_HIRED").toLowerCase()})</TD>
                  <TD><Badge tone={STATUS_TONE[v.status] ?? "neutral"}>{t(`recruitment.vacancyStatus_${v.status}`)}</Badge></TD>
                </TRow>
              ))}
              {vacancies.length === 0 && <TRow><TD colSpan={5} className="py-8 text-center text-ink-faint">{t("hr_sub.recruitmentEmpty")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
