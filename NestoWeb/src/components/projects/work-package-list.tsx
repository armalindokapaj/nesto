import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { CreateWorkPackageDialog } from "@/components/projects/create-work-package-dialog";
import { WorkPackageStatusControl } from "@/components/projects/work-package-status-control";
import { WORK_PACKAGE_STATUS_KEY } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

type WorkPackage = {
  id: string;
  name: string;
  status: string;
  progressPct: number;
  area: string | null;
  contractor: { name: string } | null;
  startDate: Date | null;
  expectedFinishDate: Date | null;
  latestUpdate: string | null;
};

// PRD_Rework_1 §11 — distinct from Tasks: real construction work packages
// (façade, flooring, plumbing, ...). "Delay" is derived here from
// expectedFinishDate, never stored, so it can't drift out of sync.
export async function WorkPackageList({
  projectId,
  workPackages,
  contractors,
  canManage,
}: {
  projectId: string;
  workPackages: WorkPackage[];
  contractors: { id: string; name: string }[];
  canManage: boolean;
}) {
  const { t } = await getT();
  const now = new Date();

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("workPackages.title")}</CardTitle>
          <CardDescription>{t("workPackages.subtitle")}</CardDescription>
        </div>
        {canManage && <CreateWorkPackageDialog projectId={projectId} contractors={contractors} />}
      </CardHeader>
      <CardContent className="space-y-2">
        {workPackages.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-faint">{t("workPackages.noWorkPackages")}</p>
        ) : (
          workPackages.map((wp) => {
            const isDelayed = wp.status !== "COMPLETED" && wp.expectedFinishDate != null && wp.expectedFinishDate < now;
            return (
              <div key={wp.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{wp.name}</p>
                    <p className="text-xs text-ink-muted">
                      {[wp.area, wp.contractor?.name].filter(Boolean).join(" · ") || t("common.none")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDelayed && <Badge tone="danger">{t("workPackages.delayed")}</Badge>}
                    <Badge status={wp.status}>{t(WORK_PACKAGE_STATUS_KEY[wp.status as keyof typeof WORK_PACKAGE_STATUS_KEY])}</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-[140px] flex-1 items-center gap-2">
                    <ProgressBar value={wp.progressPct} className="max-w-[160px]" />
                    <span className="text-xs font-medium text-ink-muted">{wp.progressPct}%</span>
                  </div>
                  {canManage && (
                    <WorkPackageStatusControl projectId={projectId} workPackageId={wp.id} status={wp.status} progressPct={wp.progressPct} />
                  )}
                </div>
                {(wp.startDate || wp.expectedFinishDate) && (
                  <p className="text-xs text-ink-faint">
                    {wp.startDate ? formatDate(wp.startDate) : "—"} → {wp.expectedFinishDate ? formatDate(wp.expectedFinishDate) : "—"}
                  </p>
                )}
                {wp.latestUpdate && <p className="text-xs text-ink-muted">{wp.latestUpdate}</p>}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
