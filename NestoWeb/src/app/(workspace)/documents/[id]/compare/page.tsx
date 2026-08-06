import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getDocumentPassport } from "@/server/documents-module";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// PRD_Documents_Module — Revision comparison, deferred item. Scoped to
// metadata side-by-side plus an inline image preview when both revisions
// are images; this app has no content-diff/PDF-diff library, so text/PDF
// content is not diffed pixel- or text-for-text, only described side by
// side (name, size, uploader, date, approval state).
export default async function CompareRevisionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { id } = await params;
  const { a, b } = await searchParams;
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "DOCUMENTS", "READ")) redirect("/dashboard/executive");

  const document = await getDocumentPassport(tenantId, id, user.id).catch(() => null);
  if (!document) notFound();
  const { t } = await getT();

  const revisionA = document.revisions.find((r) => r.id === a) ?? document.revisions[document.revisions.length - 2] ?? document.revisions[0];
  const revisionB = document.revisions.find((r) => r.id === b) ?? document.currentRevision ?? document.revisions[document.revisions.length - 1];

  return (
    <div className="space-y-6">
      <Link href={`/documents/${id}`} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> {t("common.back")}
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("documents.compareRevisions")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{document.title}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: t("documents.revisionA"), rev: revisionA },
          { label: t("documents.revisionB"), rev: revisionB },
        ].map(({ label, rev }, i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle className="text-sm">{label} — {rev?.revisionCode ?? "—"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!rev && <p className="text-ink-faint">{t("documents.noRevision")}</p>}
              {rev && (
                <>
                  <p className="text-ink-muted">{t("common.name")}: <span className="text-ink">{rev.name}</span></p>
                  <p className="text-ink-muted">{t("documents.uploadedBy")}: <span className="text-ink">{rev.uploadedBy.displayName}</span></p>
                  <p className="text-ink-muted">{t("common.date")}: <span className="text-ink">{formatDate(rev.createdAt)}</span></p>
                  <p className="text-ink-muted">{t("documents.fileSize")}: <span className="text-ink">{rev.fileSize ? formatBytes(rev.fileSize) : "—"}</span></p>
                  <p className="text-ink-muted">{t("common.status")}: <span className="text-ink">{rev.status}</span></p>
                  {rev.fileMimeType?.startsWith("image/") && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/documents/${rev.id}/file`} alt={rev.name} className="mt-2 max-h-64 rounded-lg border border-border object-contain" />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
