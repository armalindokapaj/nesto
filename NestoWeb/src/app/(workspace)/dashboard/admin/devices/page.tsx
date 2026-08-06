import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getConfigResolver } from "@/server/platform-config";
import { listAllDevicesForTenant } from "@/server/mobile-access";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RevokeDeviceButton } from "@/components/mobile-access/mobile-access-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function DeviceAccessAdminPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "USER_MANAGEMENT", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("mobile_access.page.admin")) redirect("/dashboard/admin");

  const devices = await listAllDevicesForTenant(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("mobileAccess.adminTitle")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("mobileAccess.adminSubtitle")}</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("mobileAccess.user")}</TH>
                <TH>{t("mobileAccess.deviceLabel")}</TH>
                <TH>{t("mobileAccess.platform")}</TH>
                <TH>{t("mobileAccess.lastSeen")}</TH>
                <TH>{t("common.status")}</TH>
                <TH></TH>
              </TRow>
            </THead>
            <TBody>
              {devices.map((d) => (
                <TRow key={d.id}>
                  <TD className="text-ink font-medium">{d.user.displayName}</TD>
                  <TD className="text-ink-muted">{d.deviceLabel}</TD>
                  <TD className="text-ink-muted">{d.platform}</TD>
                  <TD className="text-ink-muted">{formatDate(d.lastSeenAt)}</TD>
                  <TD><Badge tone={d.status === "ACTIVE" ? "success" : "neutral"}>{d.status}</Badge></TD>
                  <TD>{d.status === "ACTIVE" && <RevokeDeviceButton deviceId={d.id} />}</TD>
                </TRow>
              ))}
              {devices.length === 0 && <TRow><TD colSpan={6} className="py-8 text-center text-ink-faint">{t("mobileAccess.noDevices")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
