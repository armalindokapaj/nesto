import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getSetupStatus } from "@/server/setup-center";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getT } from "@/lib/i18n/server";

const STATUS_ICON = { NOT_STARTED: Circle, IN_PROGRESS: CircleDot, READY: CheckCircle2 } as const;
const STATUS_TONE = { NOT_STARTED: "neutral", IN_PROGRESS: "warning", READY: "success" } as const;

export default async function SetupCenterPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "COMPANY_SETTINGS", "FULL")) redirect("/dashboard/executive");

  const areas = await getSetupStatus(tenantId);
  const { t } = await getT();
  const readyCount = areas.filter((a) => a.status === "READY").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("setupCenter.title")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("setupCenter.subtitle")}</p>
      </div>

      <Card>
        <CardContent className="py-4">
          <p className="text-xs text-ink-faint">{t("setupCenter.readiness")}</p>
          <p className="text-2xl font-semibold text-ink mt-1">{readyCount} / {areas.length}</p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {areas.map((area) => {
          const Icon = STATUS_ICON[area.status];
          return (
            <Link key={area.key} href={area.href}>
              <Card className="transition-colors hover:border-border-strong hover:bg-surface-sunken/40">
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={area.status === "READY" ? "text-success" : area.status === "IN_PROGRESS" ? "text-warning" : "text-ink-faint"} />
                    <div>
                      <p className="text-sm font-medium text-ink">{area.label}</p>
                      <p className="text-xs text-ink-muted mt-0.5">{area.detail}</p>
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[area.status]}>{t(`setupCenter.status_${area.status}`)}</Badge>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
