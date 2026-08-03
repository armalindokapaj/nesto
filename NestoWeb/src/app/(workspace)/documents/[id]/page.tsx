import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, FileWarning } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getDocumentDetail } from "@/server/documents";
import { listAllMembers } from "@/server/admin";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BlueTicket } from "@/components/documents/blue-ticket";
import { UploadRevisionForm } from "@/components/documents/upload-revision-form";
import { RequestApprovalForm, ApprovalDecisionButtons } from "@/components/documents/document-approval-actions";
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
  REVISION_UPLOADED: "Revision uploaded",
  APPROVAL_REQUESTED: "Approval requested",
  APPROVAL_APPROVE: "Approved",
  APPROVAL_REQUEST_CHANGES: "Changes requested",
  APPROVAL_REJECT: "Rejected",
};

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "DOCUMENTS", "READ")) redirect("/dashboard/executive");

  const { chain, timeline } = await getDocumentDetail(tenantId, id);
  const { t } = await getT();

  // Newest first for display; the chain itself is stored oldest-first so
  // walking supersedesId/supersededBy stays simple in the server layer.
  const revisions = [...chain].reverse();
  const head = revisions[0];

  const canWrite = can(role, "DOCUMENTS", "WRITE");
  const canApprove = can(role, "DOCUMENTS", "FULL");

  const members = await listAllMembers(tenantId);
  const eligibleApprovers = members
    .filter((m) => can(m.role as Role, "DOCUMENTS", "FULL") && m.userId !== head.uploadedById)
    .map((m) => ({ id: m.userId, displayName: m.user.displayName }));

  const actorNames = new Map<string, string>();
  for (const rev of revisions) {
    actorNames.set(rev.uploadedById, rev.uploadedBy.displayName);
    for (const approval of rev.approvals) actorNames.set(approval.approverId, approval.approver.displayName);
  }

  return (
    <div className="space-y-6">
      <Link href="/documents" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("documents.backToDocuments")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-base">{head.name}</CardTitle>
            <CardDescription>
              {head.category}
              {head.project && (
                <>
                  {" · "}
                  <Link href={`/projects/${head.project.id}`} className="hover:text-gold hover:underline">
                    {head.project.name}
                  </Link>
                </>
              )}
              {head.task && (
                <>
                  {" · "}
                  <Link href={`/documents?taskId=${head.task.id}`} className="hover:text-gold hover:underline">
                    {head.task.title}
                  </Link>
                </>
              )}
            </CardDescription>
          </div>
          <Badge status={head.status}>{head.status}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {canWrite && (
            <div className="flex flex-wrap items-center gap-2">
              <UploadRevisionForm documentId={head.id} />
              {(head.status === "DRAFT" || head.status === "CHANGES_REQUESTED") && (
                <RequestApprovalForm documentId={head.id} approvers={eligibleApprovers} />
              )}
            </div>
          )}
          {canApprove && head.status === "SUBMITTED" && <ApprovalDecisionButtons documentId={head.id} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("documents.revisionHistory")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {revisions.map((revision, index) => {
            const uploaderSnapshot: ActorSnapshot | null = revision.uploaderSnapshot ? JSON.parse(revision.uploaderSnapshot) : null;
            const approveDecision = revision.approvals.find((a) => a.decision === "APPROVE");
            const isCurrent = index === 0;
            return (
              <div key={revision.id} className="rounded-xl border border-border p-4 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">v{revision.version}</span>
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

                {revision.fileData ? (
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
        </CardContent>
      </Card>

      {timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("documents.activity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-ink-muted">
              {timeline.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-3">
                  <span>
                    <span className="text-ink">{TIMELINE_LABELS[event.eventType] ?? event.eventType}</span>
                    {event.actorId && <span> — {actorNames.get(event.actorId) ?? event.actorId}</span>}
                  </span>
                  <span className="text-ink-faint">{formatDate(event.createdAt)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
