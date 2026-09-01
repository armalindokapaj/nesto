import { redirect } from "next/navigation";
import Link from "next/link";
import { X, BadgeCheck, Archive } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import {
  ensureRootFolders,
  backfillDocumentRecords,
  getFolderTree,
  getDocumentSummary,
  listModuleDocuments,
  flattenFolders,
  type DocumentScope,
} from "@/server/documents-module";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { FolderTree } from "@/components/documents/folder-tree";
import { CreateFolderDialog } from "@/components/documents/create-folder-dialog";
import { CreateDocumentDialog } from "@/components/documents/create-document-dialog";
import { DocumentStarButton } from "@/components/documents/document-star-button";
import { Button } from "@/components/ui/button";
import { bulkArchiveDocumentsAction } from "@/app/actions/documents-module";
import { listProjects } from "@/server/projects";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const SCOPES: { key: DocumentScope; labelKey: string; countKey: keyof Awaited<ReturnType<typeof getDocumentSummary>> }[] = [
  { key: "ALL", labelKey: "documents.scopeAll", countKey: "all" },
  { key: "STARRED", labelKey: "documents.scopeStarred", countKey: "starred" },
  { key: "MINE", labelKey: "documents.scopeMine", countKey: "mine" },
  { key: "AWAITING_APPROVAL", labelKey: "documents.scopeAwaitingApproval", countKey: "awaitingApproval" },
  { key: "APPROVED", labelKey: "documents.scopeApproved", countKey: "approved" },
  { key: "NEEDS_REVISION", labelKey: "documents.scopeNeedsRevision", countKey: "needsRevision" },
  { key: "EXPIRING", labelKey: "documents.scopeExpiring", countKey: "expiringSoon" },
  { key: "ARCHIVED", labelKey: "documents.scopeArchived", countKey: "archived" },
];

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; folderId?: string; q?: string; taskId?: string }>;
}) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ") && !can(role, "DOCUMENTS", "READ")) redirect("/dashboard/executive");
  const canCreate = can(role, "DOCUMENTS", "WRITE");

  const { scope: scopeParam, folderId, q, taskId } = await searchParams;
  const scope: DocumentScope = (SCOPES.find((s) => s.key === scopeParam)?.key ?? "ALL") as DocumentScope;

  // Idempotent — adopts any pre-module attachment (and anything created
  // through the legacy upload dialog since the last visit) into a Document
  // Passport record, so the module surfaces the tenant's real corpus.
  // Independent of each other — backfill re-runs ensureRootFolders itself on
  // the only path that needs the roots, and the create is skipDuplicates-safe,
  // so there is no reason to pay for these two round trips back to back.
  await Promise.all([ensureRootFolders(tenantId), backfillDocumentRecords(tenantId)]);

  const [tree, summary, documents, projects] = await Promise.all([
    getFolderTree(tenantId),
    getDocumentSummary(tenantId, user.id),
    listModuleDocuments(tenantId, user.id, {
      folderId: folderId || undefined,
      scope: taskId ? "ALL" : scope,
      search: q,
      linkEntityType: taskId ? "TASK" : undefined,
      linkEntityId: taskId,
    }),
    listProjects(tenantId),
  ]);
  const flatFolders = flattenFolders(tree);
  const filteredTaskTitle = taskId ? documents[0]?.title : undefined;
  const { t } = await getT();

  function scopeHref(key: DocumentScope) {
    const params = new URLSearchParams();
    if (key !== "ALL") params.set("scope", key);
    if (folderId) params.set("folderId", folderId);
    const qs = params.toString();
    return qs ? `/documents?${qs}` : "/documents";
  }

  return (
    <div className="space-y-6">
      {taskId && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-sunken/60 px-4 py-2.5 text-sm">
          <span className="text-ink-muted">
            {t("documents.filteredByTask")} <span className="font-medium text-ink">{filteredTaskTitle ?? taskId}</span>
          </span>
          <Link href="/documents" className="inline-flex items-center gap-1 text-ink-faint hover:text-ink">
            <X size={13} /> {t("documents.clearFilter")}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm">{t("documents.folders")}</CardTitle>
            {canCreate && <CreateFolderDialog folders={flatFolders} />}
          </CardHeader>
          <CardContent>
            <FolderTree nodes={tree} />
          </CardContent>
          <CardContent className="pt-0 space-y-2">
            <Link href="/documents/collections" className="block text-sm font-medium text-ink hover:text-gold">
              {t("documents.collectionsTitle")}
            </Link>
            <Link href="/documents/storage" className="block text-sm font-medium text-ink hover:text-gold">
              {t("documents.storageTitle")}
            </Link>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{t("documents.title")}</CardTitle>
                <CardDescription>{t("documents.subtitle")}</CardDescription>
              </div>
              {canCreate && <CreateDocumentDialog projects={projects.map((p) => ({ id: p.id, name: p.name }))} />}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {SCOPES.map((s) => (
                  <Link
                    key={s.key}
                    href={scopeHref(s.key)}
                    className={
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                      (scope === s.key
                        ? "border-gold/40 bg-gold/10 text-gold-deep"
                        : "border-border text-ink-muted hover:text-ink hover:bg-surface-sunken")
                    }
                  >
                    {t(s.labelKey)}
                    <span className="text-[11px] text-ink-faint">{summary[s.countKey]}</span>
                  </Link>
                ))}
              </div>

              <form className="flex items-center gap-2" method="get">
                {folderId && <input type="hidden" name="folderId" value={folderId} />}
                {scope !== "ALL" && <input type="hidden" name="scope" value={scope} />}
                <input
                  type="search"
                  name="q"
                  defaultValue={q}
                  placeholder={t("documents.searchPlaceholder")}
                  className="h-9 w-full max-w-xs rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                />
              </form>
            </CardContent>
          </Card>

          <Card>
            <form action={bulkArchiveDocumentsAction}>
              {canCreate && documents.length > 0 && (
                <div className="flex items-center justify-end px-4 pt-3">
                  <Button size="sm" variant="secondary" type="submit"><Archive size={13} /> {t("documents.bulkArchive")}</Button>
                </div>
              )}
              <CardContent className="p-0">
                <Table>
                  <THead>
                    <TRow>
                      <TH className="w-6" />
                      <TH className="w-6" />
                      <TH>{t("documents.name")}</TH>
                      <TH>{t("documents.folder")}</TH>
                      <TH>{t("common.status")}</TH>
                      <TH>{t("documents.owner")}</TH>
                      <TH>{t("dashboards.admin.joined")}</TH>
                    </TRow>
                  </THead>
                  <TBody>
                    {documents.map((doc) => (
                      <TRow key={doc.id}>
                        <TD>
                          {canCreate && <input type="checkbox" name="documentIds" value={doc.id} aria-label={t("documents.bulkArchive")} />}
                        </TD>
                        <TD>
                          <DocumentStarButton documentId={doc.id} starred={doc.isStarred} />
                        </TD>
                      <TD className="font-medium text-ink">
                        <Link href={`/documents/${doc.id}`} className="inline-flex items-center gap-1.5 hover:text-gold hover:underline">
                          {doc.title}
                          {doc.status === "APPROVED" || doc.status === "ISSUED" ? (
                            <BadgeCheck size={13} className="text-info" aria-label={t("documents.blueTicket")} />
                          ) : null}
                        </Link>
                        {doc._count.revisions > 1 && (
                          <span className="ml-1.5 text-[11px] text-ink-faint">
                            {doc._count.revisions} {t("documents.revisions")}
                          </span>
                        )}
                      </TD>
                      <TD className="text-ink-muted">{doc.primaryFolder?.name ?? "—"}</TD>
                      <TD>
                        <Badge status={doc.status}>{doc.status.replace(/_/g, " ")}</Badge>
                      </TD>
                      <TD className="text-ink-muted">
                        {doc.owner ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Avatar name={doc.owner.displayName} color={doc.owner.avatarColor ?? undefined} size={20} />
                            {doc.owner.displayName}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TD>
                      <TD className="text-ink-muted">{formatDate(doc.updatedAt)}</TD>
                    </TRow>
                  ))}
                  {documents.length === 0 && (
                    <TRow>
                      <TD colSpan={7} className="py-8 text-center text-ink-faint">
                        {t("documents.noResults")}
                      </TD>
                    </TRow>
                  )}
                </TBody>
              </Table>
              </CardContent>
            </form>
          </Card>

          <p className="px-1 text-xs text-ink-faint">{t("documents.note")}</p>
        </div>
      </div>
    </div>
  );
}
