import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { getConfigResolver } from "@/server/platform-config";
import { listMyDevices } from "@/server/mobile-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RegisterDeviceForm, RevokeDeviceButton } from "@/components/mobile-access/mobile-access-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function MyDevicesPage() {
  const { tenantId, user, company } = await getCurrentUser();
  if (!(await getConfigResolver(tenantId, company?.id))("mobile_access.page.my_devices")) redirect("/account");

  const devices = await listMyDevices(tenantId, user.id);
  const { t } = await getT();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("mobileAccess.myDevices")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("mobileAccess.myDevicesSubtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("mobileAccess.registerDevice")}</CardTitle>
        </CardHeader>
        <CardContent>
          <RegisterDeviceForm />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
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
                  <TD className="text-ink font-medium">{d.deviceLabel}</TD>
                  <TD className="text-ink-muted">{d.platform}</TD>
                  <TD className="text-ink-muted">{formatDate(d.lastSeenAt)}</TD>
                  <TD><Badge tone={d.status === "ACTIVE" ? "success" : "neutral"}>{d.status}</Badge></TD>
                  <TD>{d.status === "ACTIVE" && <RevokeDeviceButton deviceId={d.id} />}</TD>
                </TRow>
              ))}
              {devices.length === 0 && <TRow><TD colSpan={5} className="py-8 text-center text-ink-faint">{t("mobileAccess.noDevices")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
