import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { CreateApprovalDialog } from "@/components/projects/create-approval-dialog";
import { ApprovalDecisionButtons } from "@/components/projects/approval-decision-buttons";
import { PROJECT_APPROVAL_STATUS_KEY } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

type Approval = {
  id: string;
  title: string;
  description: string | null;
  department: string | null;
  relatedEntity: string | null;
  costImpact: string | null;
  timelineImpact: string | null;
  approverId: string;
  requester: { displayName: string; avatarColor: string };
  approver: { displayName: string; avatarColor: string };
  deadline: Date | null;
  status: string;
  attachments: { id: string; name: string }[];
};

// PRD_Rework_1 §12 — single required approver for v1 (no chain/escalation;
// "the detailed Approval Page module will be designed later" per the PRD).
export async function ApprovalList({
  projectId,
  approvals,
  members,
  documents,
  canManage,
  viewerId,
}: {
  projectId: string;
  approvals: Approval[];
  members: { id: string; displayName: string }[];
  documents: { id: string; name: string }[];
  canManage: boolean;
  viewerId: string;
}) {
  const { t } = await getT();

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("approvals.sectionTitle")}</CardTitle>
          <CardDescription>{t("approvals.sectionSubtitle")}</CardDescription>
        </div>
        {canManage && <CreateApprovalDialog projectId={projectId} members={members} documents={documents} />}
      </CardHeader>
      <CardContent className="space-y-2">
        {approvals.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-faint">{t("approvals.noApprovals")}</p>
        ) : (
          approvals.map((a) => (
            <div key={a.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{a.title}</p>
                  {a.description && <p className="text-xs text-ink-muted mt-0.5">{a.description}</p>}
                </div>
                <Badge status={a.status}>{t(PROJECT_APPROVAL_STATUS_KEY[a.status as keyof typeof PROJECT_APPROVAL_STATUS_KEY])}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-ink-faint">
                <span className="flex items-center gap-1.5">
                  <Avatar name={a.requester.displayName} color={a.requester.avatarColor} size={18} />
                  {a.requester.displayName}
                </span>
                <span>→</span>
                <span className="flex items-center gap-1.5">
                  <Avatar name={a.approver.displayName} color={a.approver.avatarColor} size={18} />
                  {a.approver.displayName}
                </span>
                {a.deadline && <span>· {t("approvals.deadline")}: {formatDate(a.deadline)}</span>}
              </div>
              {(a.relatedEntity || a.costImpact || a.timelineImpact) && (
                <p className="text-xs text-ink-muted">
                  {[a.relatedEntity, a.costImpact && `${t("approvals.costImpact")}: ${a.costImpact}`, a.timelineImpact && `${t("approvals.timelineImpact")}: ${a.timelineImpact}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {a.attachments.length > 0 && (
                <p className="text-xs text-ink-faint">{t("approvals.attachments")}: {a.attachments.map((doc) => doc.name).join(", ")}</p>
              )}
              {a.status === "PENDING" && a.approverId === viewerId && (
                <ApprovalDecisionButtons projectId={projectId} approvalId={a.id} />
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
