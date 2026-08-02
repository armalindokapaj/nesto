import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can, PERMISSION_MATRIX, RESOURCES } from "@/lib/permissions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ROLES, ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";

const LEVEL_TONE = {
  NONE: "neutral",
  READ: "info",
  WRITE: "warning",
  FULL: "success",
} as const;

export default async function AdminRolesPage() {
  const { role } = await getCurrentUser();
  if (!can(role, "USER_MANAGEMENT", "READ")) redirect("/dashboard/executive");

  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("admin_sub.rolesTitle")}</CardTitle>
            <CardDescription>{t("admin_sub.rolesSubtitle")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.role")}</TH>
                {RESOURCES.map((resource) => (
                  <TH key={resource}>{t(`admin_sub.resource.${resource}`)}</TH>
                ))}
              </TRow>
            </THead>
            <TBody>
              {ROLES.map((r) => (
                <TRow key={r}>
                  <TD className="font-medium text-ink whitespace-nowrap">{ROLE_LABELS[r as Role]}</TD>
                  {RESOURCES.map((resource) => {
                    const level = PERMISSION_MATRIX[r as Role][resource];
                    return (
                      <TD key={resource}>
                        <Badge tone={LEVEL_TONE[level]}>{t(`admin_sub.level.${level}`)}</Badge>
                      </TD>
                    );
                  })}
                </TRow>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
