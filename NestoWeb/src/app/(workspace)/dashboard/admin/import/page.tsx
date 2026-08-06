import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { IMPORTABLE_ENTITIES } from "@/server/import-center";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ImportCenterPanel } from "@/components/admin/import-center-panel";
import { getT } from "@/lib/i18n/server";

// PRD_Platform_UI_UX_Architecture §22 Import Center. Units already had its
// own working CSV import (Project → Units page) before this PRD was
// reopened — left as-is rather than migrated, and just linked from here for
// discoverability, since it already does the exact same
// upload/validate/preview/commit shape this hub generalizes.
export default async function ImportCenterPage() {
  const { role } = await getCurrentUser();
  if (!can(role, "HR", "WRITE") && !can(role, "CLIENTS", "WRITE")) redirect("/dashboard/executive");

  const entities = IMPORTABLE_ENTITIES.filter((e) => (e.key === "EMPLOYEES" ? can(role, "HR", "WRITE") : can(role, "CLIENTS", "WRITE")));
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("importCenter.title")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("importCenter.subtitle")}</p>
      </div>

      {entities.length > 0 ? (
        <ImportCenterPanel entities={entities} />
      ) : (
        <Card><CardContent className="py-8 text-center text-ink-faint">{t("importCenter.noPermission")}</CardContent></Card>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-sm">{t("importCenter.unitsNote")}</CardTitle>
            <CardDescription>{t("importCenter.unitsNoteDesc")}</CardDescription>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
