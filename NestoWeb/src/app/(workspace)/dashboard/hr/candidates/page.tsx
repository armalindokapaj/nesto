import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getT } from "@/lib/i18n/server";

export default async function CandidatesPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");

  const candidates = await db.candidate.findMany({
    where: { tenantId },
    include: { vacancy: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
  });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><div><CardTitle>{t("nav.candidates")}</CardTitle><CardDescription>{t("hrDashboard.candidatesSubtitle")}</CardDescription></div></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TRow><TH>{t("common.name")}</TH><TH>{t("nav.vacancies")}</TH><TH>{t("hrDashboard.source")}</TH><TH>{t("common.status")}</TH></TRow></THead>
            <TBody>
              {candidates.map((c) => (
                <TRow key={c.id}>
                  <TD className="font-medium text-ink">{c.fullName}</TD>
                  <TD className="text-ink-muted"><Link href={`/dashboard/hr/recruitment/${c.vacancy.id}`} className="hover:text-gold hover:underline">{c.vacancy.title}</Link></TD>
                  <TD className="text-ink-muted">{c.source ?? "—"}</TD>
                  <TD><Badge tone={c.stage === "HIRED" ? "success" : c.stage === "REJECTED" ? "danger" : "warning"}>{c.stage}</Badge></TD>
                </TRow>
              ))}
              {candidates.length === 0 && <TRow><TD colSpan={4} className="py-8 text-center text-ink-faint">{t("common.none")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
