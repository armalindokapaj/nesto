import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { ComingSoon } from "@/components/ui/coming-soon";
import { getT } from "@/lib/i18n/server";

export default async function TrainingPage() {
  const { role } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("hr_sub.trainingTitle")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("hr_sub.trainingSubtitle")}</p>
      </div>
      <ComingSoon message={t("hr_sub.trainingEmpty")} />
    </div>
  );
}
