import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { getT } from "@/lib/i18n/server";

type TypeCounts = { total: number; available: number; reserved: number; soldAssigned: number };

// PRD_Units §4 "Project Page -> Units" entry point — a compact summary
// (same pattern as the Project Page's own Tasks section: counts + a
// view-all link) replacing the earlier ComingSoon placeholder now that the
// Units Page and its data model actually exist.
export async function ProjectUnitsSummary({ projectId, typeSummary }: { projectId: string; typeSummary: Map<string, TypeCounts> }) {
  const { t } = await getT();

  const totals = Array.from(typeSummary.values()).reduce(
    (acc, c) => ({
      total: acc.total + c.total,
      available: acc.available + c.available,
      reserved: acc.reserved + c.reserved,
      soldAssigned: acc.soldAssigned + c.soldAssigned,
    }),
    { total: 0, available: 0, reserved: 0, soldAssigned: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("projects.units")}</CardTitle>
          <CardDescription>{t("units.projectSummarySubtitle")}</CardDescription>
        </div>
        <Link href={`/projects/${projectId}/units`} className="text-xs text-ink-muted hover:text-ink whitespace-nowrap">
          {t("units.viewAllUnits")}
        </Link>
      </CardHeader>
      <CardContent>
        {totals.total === 0 ? (
          <p className="py-6 text-center text-sm text-ink-faint">{t("units.noUnitsYet")}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-ink-muted">{t("units.total")}</p>
              <p className="mt-1 text-xl font-semibold text-ink">{totals.total}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">{t("unitStatus.available")}</p>
              <p className="mt-1 text-xl font-semibold text-ink">{totals.available}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">{t("units.held")}</p>
              <p className="mt-1 text-xl font-semibold text-ink">{totals.reserved}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">{t("units.sold")}</p>
              <p className="mt-1 text-xl font-semibold text-ink">{totals.soldAssigned}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
