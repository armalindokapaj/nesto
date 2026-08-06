import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getLegalCase } from "@/server/legal";
import { listTenantUsersForPicker } from "@/server/hse";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CaseStatusActions,
  GrantCaseAccessForm,
  RevokeCaseAccessButton,
  CreateHoldDialog,
  ReleaseHoldButton,
} from "@/components/legal/legal-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  OPEN: "info",
  IN_PROGRESS: "info",
  ON_HOLD: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
};

export default async function LegalCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "LEGAL", "READ")) redirect("/dashboard/executive");
  const canManage = can(role, "LEGAL", "FULL");

  const detail = await getLegalCase(tenantId, id, { userId: user.id, role });
  if (!detail) notFound();
  const { legalCase, project, accessGrants, activity, holds } = detail;
  const users = canManage ? await listTenantUsersForPicker(tenantId) : [];
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink flex items-center gap-2">
          {legalCase.caseNumber} — {legalCase.title}
          <Badge tone={STATUS_TONE[legalCase.status] ?? "neutral"}>{t(`legal.caseStatus_${legalCase.status}`)}</Badge>
        </h1>
        <p className="text-sm text-ink-muted mt-0.5">
          {t(`legal.caseType_${legalCase.caseType}`)} · {t(`legal.tier_${legalCase.confidentialityTier}`)}
          {project && <> · {project.code} — {project.name}</>}
          {legalCase.counterparty && <> · {t("legal.counterparty")}: {legalCase.counterparty}</>}
        </p>
        {legalCase.summary && <p className="text-sm text-ink mt-2">{legalCase.summary}</p>}
      </div>

      {canManage && (
        <Card>
          <CardContent className="py-4">
            <CaseStatusActions caseId={legalCase.id} status={legalCase.status} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("legal.caseAccess")}</CardTitle>
            <CardDescription>{t("legal.caseAccessSubtitle")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-1.5">
            {accessGrants.map((g) => (
              <li key={g.id} className="flex items-center justify-between text-sm">
                <span className="text-ink">{users.find((u) => u.id === g.userId)?.displayName ?? g.userId}</span>
                {canManage && <RevokeCaseAccessButton caseId={legalCase.id} accessId={g.id} />}
              </li>
            ))}
            {accessGrants.length === 0 && <li className="text-sm text-ink-faint">{t("legal.noAccessGrants")}</li>}
          </ul>
          {canManage && <GrantCaseAccessForm caseId={legalCase.id} users={users} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{t("legal.holds")}</CardTitle>
            </div>
            {canManage && <CreateHoldDialog cases={[{ id: legalCase.id, caseNumber: legalCase.caseNumber, title: legalCase.title }]} />}
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5">
            {holds.map((h) => (
              <li key={h.id} className="flex items-center justify-between text-sm">
                <span className="text-ink">{h.scope} <Badge tone={h.status === "ACTIVE" ? "warning" : "neutral"}>{h.status}</Badge></span>
                {canManage && h.status === "ACTIVE" && <ReleaseHoldButton holdId={h.id} caseId={legalCase.id} />}
              </li>
            ))}
            {holds.length === 0 && <li className="text-sm text-ink-faint">{t("legal.noHolds")}</li>}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("legal.activity")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {activity.map((a) => (
              <li key={a.id} className="text-sm text-ink-muted">
                <span className="text-ink">{a.summary}</span> — {formatDate(a.createdAt)}
              </li>
            ))}
            {activity.length === 0 && <li className="text-sm text-ink-faint">{t("legal.noActivity")}</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
