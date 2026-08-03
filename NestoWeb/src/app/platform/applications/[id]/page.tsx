import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { getPublicAccountFull, checkDuplicates } from "@/server/public-signup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReviewActionPanel } from "@/components/platform/review-action-panel";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await getCurrentUser();
  if (!user.isPlatformAdmin) redirect("/dashboard/executive");

  const account = await getPublicAccountFull(id);
  if (!account) redirect("/platform/applications");
  const duplicates = await checkDuplicates(id);
  const { t } = await getT();

  return (
    <div className="min-h-screen bg-canvas px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/platform/applications" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft size={14} /> {t("platform.applicationsTitle")}
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink">
              {account.accountType === "PROFESSIONAL"
                ? [account.professionalProfile?.firstName, account.professionalProfile?.lastName].filter(Boolean).join(" ") || account.email
                : account.contractorProfile?.legalBusinessName || account.email}
            </h1>
            <p className="text-sm text-ink-faint">{account.email} — {t(`apply.accountType.${account.accountType}`)}</p>
          </div>
          <Badge status={account.status}>{t(`apply.status.${account.status}`)}</Badge>
        </div>

        {duplicates.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-xs text-warning">
            <TriangleAlert size={14} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{t("platform.duplicateWarning")}</p>
              {duplicates.map((d) => (
                <p key={d.id}>{d.label} — {d.reason}</p>
              ))}
            </div>
          </div>
        )}

        {account.status === "PENDING_PLATFORM_REVIEW" || account.status === "RESUBMITTED" || account.status === "APPROVED" || account.status === "APPROVED_WITH_RESTRICTIONS" || account.status === "SUSPENDED" ? (
          <ReviewActionPanel publicAccountId={account.id} status={account.status} />
        ) : null}

        <Card>
          <CardHeader><CardTitle>{t("apply.step.profile")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {account.accountType === "PROFESSIONAL" ? (
              <>
                <InfoRow label={t("apply.professionalTitle")} value={account.professionalProfile?.title} />
                <InfoRow label={t("apply.primaryProfession")} value={account.professionalProfile?.primaryProfession ? t(`apply.profession.${account.professionalProfile.primaryProfession}`) : undefined} />
                <InfoRow label={t("apply.country")} value={account.professionalProfile?.country} />
                <InfoRow label={t("apply.city")} value={account.professionalProfile?.city} />
                <InfoRow label={t("apply.yearsExperience")} value={account.professionalProfile?.yearsExperience?.toString()} />
                <InfoRow label={t("apply.professionalEmail")} value={account.professionalProfile?.professionalEmail} />
                <div className="sm:col-span-2">
                  <p className="text-xs text-ink-faint">{t("apply.summary")}</p>
                  <p className="text-ink-muted">{account.professionalProfile?.summary || "—"}</p>
                </div>
              </>
            ) : (
              <>
                <InfoRow label={t("apply.contractorTypeLabel")} value={account.contractorProfile?.contractorType ? t(`apply.contractorType.${account.contractorProfile.contractorType}`) : undefined} />
                <InfoRow label={t("apply.legalBusinessName")} value={account.contractorProfile?.legalBusinessName} />
                <InfoRow label={t("apply.registrationNumber")} value={account.contractorProfile?.registrationNumber} />
                <InfoRow label={t("apply.vatNumber")} value={account.contractorProfile?.vatNumber} />
                <InfoRow label={t("apply.headquarters")} value={account.contractorProfile?.headquarters} />
                <InfoRow label={t("apply.mainContactPerson")} value={account.contractorProfile?.mainContactPerson} />
                <InfoRow label={t("apply.businessEmail")} value={account.contractorProfile?.businessEmail} />
                <InfoRow label={t("apply.primaryService")} value={account.contractorProfile?.primaryService ? t(`apply.service.${account.contractorProfile.primaryService}`) : undefined} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("nav.documents")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {account.documents.filter((d) => d.isActive).map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg bg-surface-sunken/60 p-2.5 text-sm">
                <div>
                  <p className="font-medium text-ink">{doc.name}</p>
                  <p className="text-xs text-ink-faint">{t(`apply.documentCategory.${doc.category}`)}</p>
                </div>
                <Badge status={doc.verificationStatus}>{doc.verificationStatus}</Badge>
              </div>
            ))}
            {account.documents.length === 0 && <p className="text-sm text-ink-faint">{t("apply.noneYet")}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("apply.step.portfolio")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {account.portfolioProjects.map((proj) => (
              <div key={proj.id} className="rounded-lg bg-surface-sunken/60 p-2.5 text-sm">
                <p className="font-medium text-ink">{proj.title}</p>
                <p className="text-xs text-ink-muted">{proj.role} — {proj.description}</p>
              </div>
            ))}
            {account.portfolioProjects.length === 0 && <p className="text-sm text-ink-faint">{t("apply.noneYet")}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("platform.reviewHistory")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {account.application?.reviews.map((review) => (
              <div key={review.id} className="rounded-lg bg-surface-sunken/60 p-2.5 text-sm">
                <p className="text-ink"><span className="font-medium">{review.reviewer.displayName}</span> — {review.action.replace(/_/g, " ")}</p>
                {review.reason && <p className="text-xs text-ink-muted mt-0.5">{review.reason}</p>}
                <p className="text-xs text-ink-faint mt-0.5">{formatDate(review.createdAt, { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            ))}
            {(account.application?.reviews.length ?? 0) === 0 && <p className="text-sm text-ink-faint">{t("platform.noReviewsYet")}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("apply.submissionHistory")}</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-3 border-l border-border pl-4">
              {account.auditEvents.map((ev) => (
                <li key={ev.id} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-gold" />
                  <p className="text-ink">{ev.summary}</p>
                  <p className="text-xs text-ink-faint">{formatDate(ev.createdAt, { hour: "2-digit", minute: "2-digit" })}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="text-ink-muted">{value || "—"}</p>
    </div>
  );
}
