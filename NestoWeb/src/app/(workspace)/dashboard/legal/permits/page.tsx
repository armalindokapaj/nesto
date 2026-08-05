import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listPermits, listAuthorities, listProjectsForPicker } from "@/server/legal";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreatePermitDialog, CreateAuthorityDialog } from "@/components/legal/legal-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function LegalPermitsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "LEGAL", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "LEGAL", "WRITE");
  const canManageAuthorities = can(role, "LEGAL", "FULL");

  const [permits, authorities, projects] = await Promise.all([listPermits(tenantId), listAuthorities(tenantId), listProjectsForPicker(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("legal.permitsTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("legal.permitsSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {canManageAuthorities && <CreateAuthorityDialog />}
          {canWrite && authorities.length > 0 && projects.length > 0 && (
            <CreatePermitDialog projects={projects} authorities={authorities.map((a) => ({ id: a.id, name: a.name }))} />
          )}
        </div>
      </div>

      {authorities.length === 0 && canManageAuthorities && <p className="text-sm text-ink-faint">{t("legal.needAuthorityFirst")}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("legal.authorities")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.name")}</TH>
                <TH>{t("legal.authorityCategory")}</TH>
                <TH>{t("legal.contactInfo")}</TH>
              </TRow>
            </THead>
            <TBody>
              {authorities.map((a) => (
                <TRow key={a.id}>
                  <TD className="text-ink font-medium">{a.name}</TD>
                  <TD className="text-ink-muted">{t(`legal.authorityCategory_${a.category}`)}</TD>
                  <TD className="text-ink-muted">{a.contactInfo ?? "—"}</TD>
                </TRow>
              ))}
              {authorities.length === 0 && (
                <TRow>
                  <TD colSpan={3} className="py-6 text-center text-ink-faint">
                    {t("legal.noAuthorities")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("legal.permitsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("legal.permitType")}</TH>
                <TH>{t("legal.authority")}</TH>
                <TH>{t("legal.project")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("legal.expiryDate")}</TH>
              </TRow>
            </THead>
            <TBody>
              {permits.map((p) => (
                <TRow key={p.id}>
                  <TD>
                    <Link href={`/dashboard/legal/permits/${p.id}`} className="font-medium text-ink hover:text-gold">
                      {t(`legal.permitType_${p.permitType}`)}
                      {p.referenceNumber ? ` · ${p.referenceNumber}` : ""}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{p.authority.name}</TD>
                  <TD>
                    <Link href={`/dashboard/legal/projects/${p.projectId}`} className="text-ink-muted hover:text-gold">
                      {t("legal.viewProject")}
                    </Link>
                  </TD>
                  <TD>
                    <Badge tone={p.status === "ISSUED" ? "success" : p.status === "REJECTED" || p.status === "REVOKED" ? "danger" : "neutral"}>
                      {t(`legal.permitStatus_${p.status}`)}
                    </Badge>
                  </TD>
                  <TD className="text-ink-muted">{p.expiryDate ? formatDate(p.expiryDate) : "—"}</TD>
                </TRow>
              ))}
              {permits.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="py-8 text-center text-ink-faint">
                    {t("legal.noPermits")}
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
