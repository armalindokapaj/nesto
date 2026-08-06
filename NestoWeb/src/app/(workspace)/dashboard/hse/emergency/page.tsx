import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listEmergencyContacts, listProjectsForPicker } from "@/server/hse";
import { getConfigResolver } from "@/server/platform-config";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddEmergencyContactDialog } from "@/components/hse/hse-dialogs";
import { getT } from "@/lib/i18n/server";
import { Phone } from "lucide-react";

export default async function EmergencyContactsPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("hse.page.emergency")) redirect("/dashboard/hse");
  const canWrite = can(role, "HSE_REPORTS", "WRITE");

  const [contacts, projects] = await Promise.all([listEmergencyContacts(tenantId), listProjectsForPicker(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("hse.emergencyTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("hse.emergencySubtitle")}</p>
        </div>
        {canWrite && projects.length > 0 && <AddEmergencyContactDialog projects={projects} />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {contacts.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex items-start gap-3 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-soft text-gold"><Phone size={16} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-ink">{c.name}</p>
                  {c.isPrimary && <Badge tone="warning">{t("hse.isPrimary")}</Badge>}
                </div>
                <p className="text-xs text-ink-muted">{t(`hse.contactType_${c.type}`)}{c.role ? ` · ${c.role}` : ""}</p>
                <p className="mt-1 text-sm text-ink">{c.phone}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {contacts.length === 0 && (
          <p className="col-span-full py-16 text-center text-sm text-ink-faint">{t("hse.noEmergencyContacts")}</p>
        )}
      </div>
    </div>
  );
}
