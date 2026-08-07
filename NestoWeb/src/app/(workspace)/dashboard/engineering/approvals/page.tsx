import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getT } from "@/lib/i18n/server";

// §22 Approvals — specifications/calculations currently under review, the
// Engineer's decision-projection surface (Workflow Engine isn't wired to
// these record types yet; shown as a direct source-state projection).
export default async function EngineeringApprovalsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const [specs, calcs] = await Promise.all([
    db.specification.findMany({ where: { tenantId, status: "IN_REVIEW" }, include: { project: { select: { id: true, name: true } } } }),
    db.calculation.findMany({ where: { tenantId, status: "UNDER_REVIEW" }, include: { project: { select: { id: true, name: true } } } }),
  ]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("nav.approvals")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.description")}</TH>
                <TH>{t("nav.projects")}</TH>
                <TH>{t("common.category")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {[...specs.map((s) => ({ ...s, kind: "Specification" })), ...calcs.map((c) => ({ ...c, kind: "Calculation" }))].map((r) => (
                <TRow key={`${r.kind}-${r.id}`}>
                  <TD className="font-medium text-ink">{r.code} · {r.title}</TD>
                  <TD className="text-ink-muted">
                    <Link href={`/dashboard/engineering/projects/${r.project.id}`} className="hover:text-gold hover:underline">
                      {r.project.name}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{r.kind}</TD>
                  <TD>
                    <Badge status={r.status}>{r.status}</Badge>
                  </TD>
                </TRow>
              ))}
              {specs.length === 0 && calcs.length === 0 && (
                <TRow>
                  <TD colSpan={4} className="py-8 text-center text-ink-faint">
                    —
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
