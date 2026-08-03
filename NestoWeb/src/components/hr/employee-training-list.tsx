import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const STATUS_TONE: Record<string, "success" | "info" | "warning" | "neutral"> = {
  COMPLETED: "success",
  IN_PROGRESS: "info",
  ASSIGNED: "neutral",
  EXPIRED: "warning",
};

export async function EmployeeTrainingList({
  records,
}: {
  records: { id: string; name: string; provider: string | null; status: string; dueDate: Date | null; completedDate: Date | null }[];
}) {
  const { t } = await getT();

  if (records.length === 0) return <p className="text-sm text-ink-muted">{t("hr_sub.noTrainingRecords")}</p>;

  return (
    <div className="space-y-2">
      {records.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
          <div className="min-w-0">
            <p className="font-medium text-ink truncate">{r.name}</p>
            <p className="text-xs text-ink-muted">
              {r.provider ?? "—"}
              {r.dueDate && ` · ${t("hr_sub.trainingDueDate")}: ${formatDate(r.dueDate)}`}
              {r.completedDate && ` · ${t("hr_sub.trainingCompletedOn")}: ${formatDate(r.completedDate)}`}
            </p>
          </div>
          <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{t(`hr_sub.trainingStatus${r.status}`)}</Badge>
        </div>
      ))}
    </div>
  );
}
