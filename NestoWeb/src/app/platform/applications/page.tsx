import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { listApplications } from "@/server/public-signup";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// PRD_6 §13 — minimal Platform Admin review queue. Gated on a single
// isPlatformAdmin flag rather than PRD_7's full separate role/session model
// (see memory: prd6-public-signup-platform-approval for the scoping note).
export default async function PlatformApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; accountType?: string }>;
}) {
  const { user } = await getCurrentUser();
  if (!user.isPlatformAdmin) redirect("/dashboard/executive");

  const { status, accountType } = await searchParams;
  const applications = await listApplications({ status, accountType });
  const { t } = await getT();

  return (
    <div className="min-h-screen bg-canvas px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("platform.applicationsTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("platform.applicationsSubtitle")}</p>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TRow>
                  <TH>{t("platform.applicant")}</TH>
                  <TH>{t("apply.accountTypeLabel")}</TH>
                  <TH>{t("common.status")}</TH>
                  <TH>{t("apply.applicationNumber")}</TH>
                  <TH>{t("apply.submittedOn")}</TH>
                </TRow>
              </THead>
              <TBody>
                {applications.map((account) => {
                  const label =
                    account.accountType === "PROFESSIONAL"
                      ? [account.professionalProfile?.firstName, account.professionalProfile?.lastName].filter(Boolean).join(" ") || account.email
                      : account.contractorProfile?.legalBusinessName || account.email;
                  return (
                    <TRow key={account.id}>
                      <TD>
                        <Link href={`/platform/applications/${account.id}`} className="font-medium text-ink hover:text-gold hover:underline">
                          {label}
                        </Link>
                        <p className="text-xs text-ink-faint">{account.email}</p>
                      </TD>
                      <TD className="text-ink-muted">{t(`apply.accountType.${account.accountType}`)}</TD>
                      <TD>
                        <Badge status={account.status}>{t(`apply.status.${account.status}`)}</Badge>
                      </TD>
                      <TD className="text-ink-muted">{account.application?.applicationNumber ?? "—"}</TD>
                      <TD className="text-ink-muted">{account.application ? formatDate(account.application.submittedAt) : "—"}</TD>
                    </TRow>
                  );
                })}
                {applications.length === 0 && (
                  <TRow>
                    <TD colSpan={5} className="text-center text-ink-faint py-10">
                      {t("platform.noApplications")}
                    </TD>
                  </TRow>
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
