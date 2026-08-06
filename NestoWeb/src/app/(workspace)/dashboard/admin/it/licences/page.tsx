import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getConfigResolver } from "@/server/platform-config";
import { listSoftwareLicences } from "@/server/it-admin";
import { listTenantUsersForPicker } from "@/server/hse";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { CreateLicenceDialog, AssignSeatForm } from "@/components/it-admin/it-admin-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function ItLicencesPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "COMPANY_SETTINGS", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("it_admin.page.licences")) redirect("/dashboard/admin/it");
  const canManage = can(role, "COMPANY_SETTINGS", "FULL");

  const [licences, users] = await Promise.all([listSoftwareLicences(tenantId), canManage ? listTenantUsersForPicker(tenantId) : Promise.resolve([])]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">{t("itAdmin.licences")}</h1>
        {canManage && <CreateLicenceDialog />}
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("itAdmin.productName")}</TH>
                <TH>{t("itAdmin.vendor")}</TH>
                <TH>{t("itAdmin.seatsUsed")} / {t("itAdmin.seatsTotal")}</TH>
                <TH>{t("itAdmin.expiresAt")}</TH>
                {canManage && <TH>{t("itAdmin.assignSeat")}</TH>}
              </TRow>
            </THead>
            <TBody>
              {licences.map((l) => (
                <TRow key={l.id}>
                  <TD className="text-ink font-medium">{l.productName}</TD>
                  <TD className="text-ink-muted">{l.vendor ?? "—"}</TD>
                  <TD className="text-ink-muted">{l.seatsUsed} / {l.seatsTotal}</TD>
                  <TD className="text-ink-muted">{l.expiresAt ? formatDate(l.expiresAt) : "—"}</TD>
                  {canManage && <TD><AssignSeatForm licenceId={l.id} users={users} /></TD>}
                </TRow>
              ))}
              {licences.length === 0 && <TRow><TD colSpan={5} className="py-8 text-center text-ink-faint">{t("itAdmin.noLicences")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
