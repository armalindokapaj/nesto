import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getConfigResolver } from "@/server/platform-config";
import { listItDevices } from "@/server/it-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateDeviceDialog, DeviceStatusActions } from "@/components/it-admin/it-admin-dialogs";
import { getT } from "@/lib/i18n/server";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "success",
  IN_REPAIR: "warning",
  LOST: "danger",
  RETIRED: "neutral",
};

export default async function ItDevicesPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "COMPANY_SETTINGS", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("it_admin.page.devices")) redirect("/dashboard/admin/it");
  const canManage = can(role, "COMPANY_SETTINGS", "FULL");

  const devices = await listItDevices(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">{t("itAdmin.devices")}</h1>
        {canManage && <CreateDeviceDialog />}
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("itAdmin.deviceName")}</TH>
                <TH>{t("itAdmin.deviceType")}</TH>
                <TH>{t("itAdmin.serialNumber")}</TH>
                <TH>{t("common.status")}</TH>
                <TH></TH>
              </TRow>
            </THead>
            <TBody>
              {devices.map((d) => (
                <TRow key={d.id}>
                  <TD className="text-ink font-medium">{d.name}</TD>
                  <TD className="text-ink-muted">{d.deviceType}</TD>
                  <TD className="text-ink-muted">{d.serialNumber ?? "—"}</TD>
                  <TD><Badge tone={STATUS_TONE[d.status] ?? "neutral"}>{d.status}</Badge></TD>
                  <TD>{canManage && <DeviceStatusActions deviceId={d.id} status={d.status} />}</TD>
                </TRow>
              ))}
              {devices.length === 0 && <TRow><TD colSpan={5} className="py-8 text-center text-ink-faint">{t("itAdmin.noDevices")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
