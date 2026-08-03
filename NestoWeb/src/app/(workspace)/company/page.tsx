import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getCompanyProfile } from "@/server/company";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UpdateCompanyForm } from "@/components/company/update-company-form";
import { getT } from "@/lib/i18n/server";

export default async function CompanyPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "COMPANY_SETTINGS", "READ")) redirect("/dashboard/executive");
  const canEdit = can(role, "COMPANY_SETTINGS", "FULL");

  const company = await getCompanyProfile(tenantId);
  const { t } = await getT();

  if (!company) redirect("/dashboard/executive");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("company.title")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("company.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{company.name}</CardTitle>
          <CardDescription>{company.legalName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-ink-muted">{t("company.country")}</p>
              <p className="text-sm font-medium text-ink mt-1">{company.countryCode}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">{t("company.plan")}</p>
              <p className="text-sm font-medium text-ink mt-1">{company.planName}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">{t("company.seatLimit")}</p>
              <p className="text-sm font-medium text-ink mt-1">{company.seatLimit}</p>
            </div>
          </div>

          {canEdit && <UpdateCompanyForm legalName={company.legalName ?? company.name} countryCode={company.countryCode} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("company.branches")}</CardTitle>
        </CardHeader>
        <CardContent>
          {company.branches.length === 0 ? (
            <p className="text-sm text-ink-faint py-6 text-center">—</p>
          ) : (
            <ul className="space-y-3">
              {company.branches.map((branch) => (
                <li key={branch.id} className="flex items-center justify-between gap-3 text-sm border-b border-border last:border-0 pb-3 last:pb-0">
                  <div>
                    <p className="font-medium text-ink">{branch.name}</p>
                    <p className="text-xs text-ink-muted">{branch.address ?? "—"}</p>
                  </div>
                  {branch.isRegisteredBranch && <Badge tone="info">{t("company.registeredBranch")}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {company.isParent && (
        <Card>
          <CardHeader>
            <CardTitle>{t("company.childCompanies")}</CardTitle>
            <CardDescription>{t("company.childCompaniesSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            {company.childCompanies.length === 0 ? (
              <p className="text-sm text-ink-faint py-6 text-center">—</p>
            ) : (
              <ul className="space-y-3">
                {company.childCompanies.map((child) => (
                  <li key={child.id} className="border-b border-border last:border-0 pb-3 last:pb-0">
                    <p className="font-medium text-ink text-sm">{child.name}</p>
                    <p className="text-xs text-ink-muted">{child.legalName}</p>
                    {child.branches.length > 0 && (
                      <p className="text-xs text-ink-faint mt-1">
                        {child.branches.map((b) => b.name).join(" · ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
