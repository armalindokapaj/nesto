import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listDrawings } from "@/server/architecture";
import { Card, CardContent } from "@/components/ui/card";
import { DrawingDecisionButtons } from "@/components/architecture/drawing-decision-buttons";
import { getT } from "@/lib/i18n/server";

export default async function ApprovalsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const canDecide = can(role, "TASKS", "WRITE");

  const drawings = await listDrawings(tenantId, "IN_REVIEW");
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("architect_sub.approvalsTitle")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("architect_sub.approvalsSubtitle")}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {drawings.length === 0 ? (
            <p className="text-sm text-ink-faint py-16 text-center">{t("inbox.empty")}</p>
          ) : (
            <ul>
              {drawings.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{d.packageName} · {d.revisionCode}</p>
                    <p className="text-xs text-ink-muted">
                      <Link href={`/projects/${d.project.id}`} className="hover:text-gold hover:underline">
                        {d.project.name}
                      </Link>{" "}
                      · {d.discipline ?? "—"}
                    </p>
                  </div>
                  {canDecide && <DrawingDecisionButtons drawingId={d.id} />}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
