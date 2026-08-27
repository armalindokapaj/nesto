import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Archive, ArchiveRestore, Download, FileWarning } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getDocumentPassport, getFolderTree, flattenFolders, listReadReceipts } from "@/server/documents-module";
import { RequiredReadingCard } from "@/components/documents/required-reading-card";
import { archiveDocumentAction, restoreDocumentAction } from "@/app/actions/documents-module";
import { listAllMembers } from "@/server/admin";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BlueTicket } from "@/components/documents/blue-ticket";
import { UploadRevisionForm } from "@/components/documents/upload-revision-form";
import { RequestApprovalForm, ApprovalDecisionButtons } from "@/components/documents/document-approval-actions";
import { DocumentStarButton } from "@/components/documents/document-star-button";
import { PromoteTranzitForm } from "@/components/documents/promote-tranzit-form";
import { ShortcutManager } from "@/components/documents/shortcut-manager";
import { CommentThread } from "@/components/documents/comment-thread";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import type { Role } from "@/lib/constants";
import type { ActorSnapshot } from "@/lib/actor-snapshot";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TIMELINE_LABELS: Record<string, string> = {
  CREATED: "Document created",
  REVISION_UPLOADED: "Revision uploaded",
  APPROVAL_REQUESTED: "Approval requested",
  APPROVAL_APPROVE: "Approved",
  APPROVAL_REQUEST_CHANGES: "Changes requested",
  APPROVAL_REJECT: "Rejected",
  PROMOTED_FROM_TRANZIT: "Promoted from Tranzit",
  SHORTCUT_ADDED: "Shortcut added",
  SHORTCUT_REMOVED: "Shortcut removed",
  ARCHIVED: "Archived",
  RESTORED: "Restored",
  COMMENTED: "Comment added",
  REQUIRED_READING_ASSIGNED: "Required reading assigned",
  REQUIRED_READING_ACKNOWLEDGED: "Marked as read",
};

const ENTITY_LINK: Record<string, (id: string) => string> = {
  PROJECT: (id) => `/projects/${id}`,
};

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "DOCUMENTS", "READ")) redirect("/dashboard/executive");

  const [document, tree] = await Promise.all([getDocumentPassport(tenantId, id, user.id), getFolderTree(tenantId)]);
  const { t } = await getT();

  // Newest first for display; the underlying chain is stored oldest-first.
  const revisions = [...document.revisions].reverse();
  const head = document.currentRevision ?? revisions[0];

  const canWrite = can(role, "DOCUMENTS", "WRITE");
  const canApprove = can(role, "DOCUMENTS", "FULL");

  const [members, readReceipts] = await Promise.all([listAllMembers(tenantId), listReadReceipts(tenantId, id)]);
  const eligibleApprovers = head
    ? members
        .filter((m) => can(m.role as Role, "DOCUMENTS", "FULL") && m.userId !== head.uploadedById)
        .map((m) => ({ id: m.userId, displayName: m.user.displayName }))
    : [];

  const flatFolders = flattenFolders(tree);
  const placements = document.folderRefs.map((ref) => ({
    folderId: ref.folderId,
    folderName: ref.folder.name,
    isPrimary: ref.isPrimary,
  }));

  const isTranzit = document.status === "TRANZIT";
  const canRequestApproval = head && ["DRAFT", "CHANGES_REQUESTED", "NEEDS_REVISION"].includes(head.status);
  const canDecideApproval = head && head.status === "SUBMITTED";

  return (
    <div className="space-y-6">
      <Link href="/documents" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("documents.backToDocuments")}
      </Link>

      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-center gap-2">
            <DocumentStarButton documentId={document.id} starred={document.isStarred} size={17} />
            <div className="min-w-0">
              <CardTitle className="truncate text-base">
                {document.title}
                {document.code && <span className="ml-1.5 font-mono text-xs text-ink-faint">{document.code}</span>}
              </CardTitle>
              <CardDescription>
                {document.primaryFolder?.name ?? "—"}
                {" · "}
                {t("documents.owner")}: {document.owner?.displayName ?? "—"}
                {document.links.length > 0 && (
                  <>
                    {" · "}
                    {document.links.map((l, i) => {
                      const href = ENTITY_LINK[l.entityType]?.(l.entityId);
                      const label = l.entityType.charAt(0) + l.entityType.slice(1).toLowerCase();
                      return (
                        <span key={l.id}>
                          {i > 0 && ", "}
                          {href ? (
                            <Link href={href} className="hover:text-gold hover:underline">
                              {label}
                            </Link>
                          ) : (
                            label
                          )}
                        </span>
                      );
                    })}
                  </>
                )}
              </CardDescription>
            </div>
          </div>
          <Badge status={document.status}>{document.status.replace(/_/g, " ")}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {isTranzit && <p className="rounded-lg bg-surface-sunken px-3 py-2 text-xs text-ink-muted">{t("documents.tranzitNotice")}</p>}

          <div className="flex flex-wrap items-center gap-2">
            {canWrite && head && <UploadRevisionForm documentId={head.id} />}
            {canWrite && head && canRequestApproval && <RequestApprovalForm documentId={head.id} approvers={eligibleApprovers} />}
            {canWrite && isTranzit && <PromoteTranzitForm documentId={document.id} folders={flatFolders} />}
            {canWrite && !document.archivedAt && (
              <form action={archiveDocumentAction.bind(null, document.id)}>
                <Button size="sm" variant="secondary" type="submit">
                  <Archive size={14} /> {t("documents.archiveDocument")}
                </Button>
              </form>
            )}
            {canWrite && document.archivedAt && (
              <form action={restoreDocumentAction.bind(null, document.id)}>
                <Button size="sm" variant="secondary" type="submit">
                  <ArchiveRestore size={14} /> {t("documents.restoreDocument")}
                </Button>
              </form>
            )}
            {head?.fileMimeType?.startsWith("image/") && (
              <a href={`/api/documents/${head.id}/watermark`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="secondary" type="button">{t("documents.watermarkPreview")}</Button>
              </a>
            )}
          </div>
          {canApprove && head && canDecideApproval && <ApprovalDecisionButtons documentId={head.id} />}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{t("documents.revisionHistory")}</CardTitle>
                {revisions.length > 1 && (
                  <Link href={`/documents/${document.id}/compare`} className="text-xs text-gold hover:underline">{t("documents.compareRevisions")}</Link>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {revisions.map((revision, index) => {
                const uploaderSnapshot: ActorSnapshot | null = revision.uploaderSnapshot ? JSON.parse(revision.uploaderSnapshot) : null;
                const approveDecision = revision.approvals.find((a) => a.decision === "APPROVE");
                const isCurrent = index === 0;
                return (
                  <div key={revision.id} className="space-y-2.5 rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{revision.revisionCode ?? `v${revision.version}`}</span>
                      <Badge status={revision.status}>{revision.status}</Badge>
                      {isCurrent && (
                        <Badge tone="info" className="!bg-transparent border border-info/30">
                          {t("documents.current")}
                        </Badge>
                      )}
                      {approveDecision && (
                        <BlueTicket
                          approverSnapshot={JSON.parse(approveDecision.approverSnapshot)}
                          comment={approveDecision.comment}
                          approvedAt={approveDecision.createdAt}
                        />
                      )}
                    </div>

                    {revision.status === "SUPERSEDED" && (
                      <p className="flex items-center gap-1.5 text-xs text-warning">
                        <FileWarning size={13} /> {t("documents.supersededNotice")}
                      </p>
                    )}

                    {revision.revisionComment && <p className="text-sm text-ink">{revision.revisionComment}</p>}

                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-muted sm:grid-cols-4">
                      <div>
                        <dt className="text-ink-faint">{t("documents.uploader")}</dt>
                        <dd className="text-ink">{revision.uploadedBy.displayName}</dd>
                      </div>
                      {uploaderSnapshot && (
                        <div>
                          <dt className="text-ink-faint">{t("documents.owningCompany")}</dt>
                          <dd className="text-ink">{uploaderSnapshot.companyName || "—"}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-ink-faint">{t("dashboards.admin.joined")}</dt>
                        <dd className="text-ink">{formatDate(revision.createdAt)}</dd>
                      </div>
                      {revision.checksum && (
                        <div className="col-span-2 sm:col-span-4">
                          <dt className="text-ink-faint">{t("documents.checksum")}</dt>
                          <dd className="break-all font-mono text-[11px] text-ink">{revision.checksum}</dd>
                        </div>
                      )}
                    </dl>

                    {revision.fileUrl ? (
                      <a
                        href={`/api/documents/${revision.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-gold hover:underline"
                      >
                        <Download size={13} /> {t("documents.download")} ({formatBytes(revision.fileSize ?? 0)})
                      </a>
                    ) : (
                      <p className="text-xs text-ink-faint">{t("documents.noFile")}</p>
                    )}

                    {revision.approvals.length > 0 && (
                      <ul className="space-y-1 border-t border-border pt-2 text-xs text-ink-muted">
                        {revision.approvals.map((a) => (
                          <li key={a.id}>
                            <Badge status={a.decision === "APPROVE" ? "APPROVED" : a.decision === "REJECT" ? "REJECTED" : "CHANGES_REQUESTED"}>
                              {a.decision.replace(/_/g, " ")}
                            </Badge>{" "}
                            {a.approver.displayName} — {formatDate(a.createdAt)}
                            {a.comment && <span className="italic"> · &ldquo;{a.comment}&rdquo;</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
              {revisions.length === 0 && <p className="text-xs text-ink-faint">{t("documents.noFile")}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("documents.comments")}</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentThread
                documentId={document.id}
                comments={document.comments.map((c) => ({
                  id: c.id,
                  body: c.body,
                  createdAt: c.createdAt,
                  author: { displayName: c.author.displayName, avatarColor: c.author.avatarColor },
                }))}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("documents.controls")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-ink-muted">
              <div className="flex items-center justify-between">
                <span>{t("documents.confidentiality")}</span>
                <Badge tone={document.confidentiality === "RESTRICTED" ? "danger" : document.confidentiality === "CONFIDENTIAL" ? "warning" : "neutral"}>
                  {document.confidentiality}
                </Badge>
              </div>
              {document.expiresAt && (
                <div className="flex items-center justify-between">
                  <span>{t("documents.expiresOn")}</span>
                  <span className="text-ink">{formatDate(document.expiresAt)}</span>
                </div>
              )}
              {document.legalHold && (
                <div className="flex items-center justify-between text-warning">
                  <span>{t("documents.legalHold")}</span>
                  <span>●</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("documents.requiredReading")}</CardTitle>
            </CardHeader>
            <CardContent>
              <RequiredReadingCard
                documentId={document.id}
                required={document.requiredReading}
                receipts={readReceipts}
                currentUserId={user.id}
                canAssign={canWrite}
                members={members.map((m) => ({ id: m.userId, displayName: m.user.displayName }))}
              />
            </CardContent>
          </Card>

          {(document.dependsOn.length > 0 || document.dependedOnBy.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("documents.dependenciesAndImpact")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {document.dependsOn.length > 0 && (
                  <div>
                    <p className="mb-1 text-ink-faint">{t("documents.dependsOn")}</p>
                    <ul className="space-y-1">
                      {document.dependsOn.map((d) => (
                        <li key={d.id}>
                          <Link href={`/documents/${d.dependsOn.id}`} className="text-ink hover:text-gold hover:underline">{d.dependsOn.title}</Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {document.dependedOnBy.length > 0 && (
                  <div>
                    <p className="mb-1 flex items-center gap-1.5 text-warning"><FileWarning size={12} /> {t("documents.impactedByChange")}</p>
                    <ul className="space-y-1">
                      {document.dependedOnBy.map((d) => (
                        <li key={d.id}>
                          <Link href={`/documents/${d.document.id}`} className="text-ink hover:text-gold hover:underline">{d.document.title}</Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {document.duplicates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-1.5 text-warning"><FileWarning size={13} /> {t("documents.possibleDuplicates")}</CardTitle>
                <CardDescription>{t("documents.possibleDuplicatesDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-xs">
                  {document.duplicates.map((d) => (
                    <li key={d.id}>
                      <Link href={`/documents/${d.id}`} className="text-ink hover:text-gold hover:underline">{d.code} — {d.title}</Link>
                      {d.primaryFolder && <span className="text-ink-faint"> ({d.primaryFolder.name})</span>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("documents.shortcuts")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ShortcutManager documentId={document.id} placements={placements} candidateFolders={flatFolders} />
            </CardContent>
          </Card>

          {document.activity.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("documents.activity")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5 text-xs text-ink-muted">
                  {document.activity.map((event) => (
                    <li key={event.id} className="flex items-start gap-2">
                      {event.actor && <Avatar name={event.actor.displayName} color={event.actor.avatarColor ?? undefined} size={20} />}
                      <div className="min-w-0 flex-1">
                        <p className="text-ink">{TIMELINE_LABELS[event.eventType] ?? event.eventType}</p>
                        <p className="text-ink-faint">{formatDate(event.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
