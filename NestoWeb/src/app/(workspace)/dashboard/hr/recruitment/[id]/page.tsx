import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getConfigResolver } from "@/server/platform-config";
import { getVacancy } from "@/server/recruitment";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  VacancyStatusActions,
  CreateCandidateDialog,
  CandidateStageActions,
  CreateOfferDialog,
  OfferStatusActions,
} from "@/components/recruitment/recruitment-dialogs";
import { getT } from "@/lib/i18n/server";

const STAGE_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  APPLIED: "neutral",
  SCREENING: "info",
  INTERVIEW: "info",
  OFFER: "warning",
  HIRED: "success",
  REJECTED: "danger",
};

const OFFER_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  DRAFT: "neutral",
  SENT: "info",
  ACCEPTED: "success",
  DECLINED: "danger",
  WITHDRAWN: "neutral",
};

export default async function VacancyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("hr.page.recruitment")) redirect("/dashboard/hr");
  const canManage = can(role, "HR", "WRITE");

  const vacancy = await getVacancy(tenantId, id).catch(() => null);
  if (!vacancy) notFound();
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink flex items-center gap-2">
            {vacancy.title}
            <Badge tone="neutral">{t(`recruitment.vacancyStatus_${vacancy.status}`)}</Badge>
          </h1>
          <p className="text-sm text-ink-muted mt-0.5">{vacancy.department ?? "—"} · {vacancy.position ?? "—"} · {t("recruitment.headcount")}: {vacancy.headcount}</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && <VacancyStatusActions vacancyId={vacancy.id} status={vacancy.status} />}
          {canManage && <CreateCandidateDialog vacancyId={vacancy.id} />}
        </div>
      </div>

      <div className="space-y-4">
        {vacancy.candidates.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {c.fullName}
                    <Badge tone={STAGE_TONE[c.stage] ?? "neutral"}>{t(`recruitment.stage_${c.stage}`)}</Badge>
                  </CardTitle>
                  <CardDescription>{[c.email, c.phone, c.source].filter(Boolean).join(" · ") || "—"}</CardDescription>
                </div>
                {canManage && <CandidateStageActions candidateId={c.id} vacancyId={vacancy.id} stage={c.stage} />}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {c.offers.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="text-ink">
                    {o.position} — {o.compensation ? `${o.compensation} ${o.currency}` : "—"}{" "}
                    <Badge tone={OFFER_TONE[o.status] ?? "neutral"}>{t(`recruitment.offerStatus_${o.status}`)}</Badge>
                  </span>
                  {canManage && <OfferStatusActions offerId={o.id} vacancyId={vacancy.id} status={o.status} />}
                </div>
              ))}
              {canManage && c.stage === "OFFER" && c.offers.every((o) => o.status === "WITHDRAWN" || o.status === "DECLINED") && (
                <CreateOfferDialog candidateId={c.id} vacancyId={vacancy.id} />
              )}
            </CardContent>
          </Card>
        ))}
        {vacancy.candidates.length === 0 && (
          <Card><CardContent className="py-8 text-center text-ink-faint">{t("recruitment.noCandidates")}</CardContent></Card>
        )}
      </div>
    </div>
  );
}
