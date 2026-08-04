import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { getUnit } from "@/server/units";
import { listUnitRenders } from "@/server/unit-renders";
import { listUnitDocuments } from "@/server/documents";
import { listUnitActivity } from "@/server/unit-activity";
import { listProjectStructures } from "@/server/project-structures";
import { canViewUnits, canManageUnits } from "@/lib/unit-access";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ComingSoon } from "@/components/ui/coming-soon";
import { AccessDenied } from "@/components/ui/access-denied";
import { UnitHeader } from "@/components/projects/units/unit-header";
import { UnitOverviewPanel } from "@/components/projects/units/unit-overview-panel";
import { AreaPricingEditor } from "@/components/projects/units/area-pricing-editor";
import { DocumentCategorySection } from "@/components/projects/document-category-section";
import { UnitActivityTimeline } from "@/components/projects/units/unit-activity-timeline";
import { finalPrice } from "@/lib/unit-pricing";
import { UNIT_DOCUMENT_CATEGORIES } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";

export default async function UnitDetailPage({ params }: { params: Promise<{ id: string; unitId: string }> }) {
  const { id: projectId, unitId } = await params;
  const { tenantId, role } = await getCurrentUser();
  const { t } = await getT();

  if (!canViewUnits(role)) {
    return <AccessDenied backHref={`/projects/${projectId}/units`} backLabel={t("units.pageTitle")} message={t("units.accessDenied")} />;
  }

  const [unit, renders, documents, activity, structures] = await Promise.all([
    getUnit(tenantId, unitId),
    listUnitRenders(tenantId, unitId),
    listUnitDocuments(tenantId, unitId),
    listUnitActivity(tenantId, unitId),
    listProjectStructures(tenantId, projectId),
  ]);

  const canManage = canManageUnits(role);
  const priceValue = finalPrice(unit.areaComponents, unit.fixedAdjustment);

  return (
    <div className="space-y-6">
      <Link href={`/projects/${projectId}/units`} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> {t("units.pageTitle")}
      </Link>

      <UnitHeader projectId={projectId} unit={unit} finalPriceValue={priceValue} renders={renders} canManage={canManage} />

      {/* Same remount-on-save reasoning as AreaPricingEditor below. */}
      <UnitOverviewPanel key={unit.version} projectId={projectId} unit={unit} structures={structures} canManage={canManage} />

      {/* key=version forces a remount (and fresh local state) whenever a save
          changes the server truth — a client component's useState initializer
          only runs once on mount, so without this the editor would keep
          showing stale values (e.g. the old price/m2) after its own save. */}
      <AreaPricingEditor
        key={unit.version}
        projectId={projectId}
        unitId={unit.id}
        currency={unit.currency}
        fixedAdjustment={unit.fixedAdjustment}
        initialComponents={unit.areaComponents}
        canManage={canManage}
      />

      {/* PRD_Unit_Page §7 — Sales, Client, Interested Parties: Pass 2 (holds/reservations/buyer/contract domain doesn't exist yet). */}
      <Card>
        <CardHeader>
          <CardTitle>{t("units.salesClient")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ComingSoon message={t("units.salesClientComingSoon")} />
        </CardContent>
      </Card>

      {/* PRD_Unit_Page §10 — Payments: Pass 2 (needs the reservation/contract this unit doesn't have yet to project against). */}
      <Card>
        <CardHeader>
          <CardTitle>{t("units.payments")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ComingSoon message={t("units.paymentsComingSoon")} />
        </CardContent>
      </Card>

      <DocumentCategorySection
        title={t("units.documentsTitle")}
        description={t("units.documentsSubtitle")}
        categories={UNIT_DOCUMENT_CATEGORIES}
        documents={documents}
        projectId={projectId}
        unitId={unit.id}
        canUpload={canManage}
        uploadLabel={t("documents.newDocument")}
        emptyLabel={t("units.noDocuments")}
      />

      {/* PRD_Unit_Page §12 — Linked Assets / Sales Packages: Pass 2. */}
      <Card>
        <CardHeader>
          <CardTitle>{t("units.linkedAssets")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ComingSoon message={t("units.linkedAssetsComingSoon")} />
        </CardContent>
      </Card>

      {/* PRD_Unit_Page §13 — Client Changes and Approvals: Pass 2. */}
      <Card>
        <CardHeader>
          <CardTitle>{t("units.clientChanges")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ComingSoon message={t("units.clientChangesComingSoon")} />
        </CardContent>
      </Card>

      {/* PRD_Unit_Page §14 — Handover and Defects: Pass 2. */}
      <Card>
        <CardHeader>
          <CardTitle>{t("units.handover")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ComingSoon message={t("units.handoverComingSoon")} />
        </CardContent>
      </Card>

      <UnitActivityTimeline events={activity} />
    </div>
  );
}
