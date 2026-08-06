import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listLegalHolds, listLegalCases } from "@/server/legal";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateHoldDialog, ReleaseHoldButton } from "@/components/legal/legal-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function LegalHoldsPage() {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "LEGAL", "READ")) redirect("/dashboard/executive");
  const canManage = can(role, "LEGAL", "FULL");

  const [holds, cases] = await Promise.all([
    listLegalHolds(tenantId),
    listLegalCases(tenantId, { userId: user.id, role }),
  ]);
  const casesById = new Map(cases.map((c) => [c.id, c]));
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("legal.holdsTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("legal.holdsSubtitle")}</p>
        </div>
        {canManage && <CreateHoldDialog cases={cases.map((c) => ({ id: c.id, caseNumber: c.caseNumber, title: c.title }))} />}
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("legal.holdScope")}</TH>
                <TH>{t("legal.relatedCase")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("common.date")}</TH>
                <TH></TH>
              </TRow>
            </THead>
            <TBody>
              {holds.map((h) => (
                <TRow key={h.id}>
                  <TD className="text-ink font-medium">{h.scope}</TD>
                  <TD className="text-ink-muted">{h.caseId ? (casesById.get(h.caseId)?.caseNumber ?? "—") : "—"}</TD>
                  <TD><Badge tone={h.status === "ACTIVE" ? "warning" : "neutral"}>{h.status}</Badge></TD>
                  <TD className="text-ink-muted">{formatDate(h.placedAt)}</TD>
                  <TD>{canManage && h.status === "ACTIVE" && <ReleaseHoldButton holdId={h.id} caseId={h.caseId ?? undefined} />}</TD>
                </TRow>
              ))}
              {holds.length === 0 && <TRow><TD colSpan={5} className="py-8 text-center text-ink-faint">{t("legal.noHolds")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
