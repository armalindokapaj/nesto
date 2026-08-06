import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getStorageDashboard } from "@/server/documents-module";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getT } from "@/lib/i18n/server";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default async function StorageDashboardPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "DOCUMENTS", "READ")) redirect("/dashboard/executive");

  const dashboard = await getStorageDashboard(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("documents.storageTitle")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("documents.storageSubtitle")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-ink-faint">{t("documents.totalStorage")}</p>
            <p className="text-2xl font-semibold text-ink mt-1">{formatBytes(dashboard.totalBytes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-ink-faint">{t("documents.totalRevisions")}</p>
            <p className="text-2xl font-semibold text-ink mt-1">{dashboard.revisionCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">{t("documents.byFileType")}</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {dashboard.byType.map((t1) => (
            <div key={t1.type} className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">{t1.type} ({t1.count})</span>
              <span className="text-ink">{formatBytes(t1.bytes)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">{t("documents.byFolder")}</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {dashboard.byFolder.map((f) => (
            <div key={f.folder} className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">{f.folder} ({f.count})</span>
              <span className="text-ink">{formatBytes(f.bytes)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
