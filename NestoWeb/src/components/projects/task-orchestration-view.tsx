"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import { CheckCircle2, ChevronRight, Circle, FileDown, MinusCircle, XCircle, AlertTriangle } from "lucide-react";
import type { TaskOrchestrationData } from "@/server/task-orchestration";
import {
  transitionStageAction,
  submitDeliverableAction,
  markNotRequiredAction,
  recordApprovalAction,
  markConditionsMetAction,
  respondInvolvementAction,
  createTaskCommentAction,
} from "@/app/actions/task-orchestration";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/input";
import { CreateDocumentDialog } from "@/components/documents/create-document-dialog";
import {
  ActivateDepartmentDialog,
  RequestInvolvementDialog,
  LinkContractDialog,
  AssignContractorDialog,
  RecordInspectionDialog,
  ExplainDelayDialog,
  EscalateDialog,
  CompleteTaskDialog,
  ReopenTaskDialog,
} from "@/components/projects/task-orchestration-dialogs";
import { DEPARTMENT_LABELS, APPROVAL_ACTIONS } from "@/lib/constants";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

type Member = { id: string; displayName: string; role: string };
type Contractor = { id: string; name: string; tradeType: string };
type Contract = { id: string; number: string; title: string };
type Comment = { id: string; body: string; createdAt: string | Date; author: { displayName: string; avatarColor: string } };
type GateStatus = { canComplete: boolean; blockers: string[] };

const STAGE_ICON = { COMPLETED: CheckCircle2, ACTIVE: Circle, SKIPPED: MinusCircle, REJECTED: XCircle, PENDING: Circle, WAITING: Circle } as const;

export function TaskOrchestrationView({
  task,
  comments,
  members,
  contractors,
  contracts,
  gate,
  currentUserId,
  role,
}: {
  task: TaskOrchestrationData;
  comments: Comment[];
  members: Member[];
  contractors: Contractor[];
  contracts: Contract[];
  gate: GateStatus;
  currentUserId: string;
  role: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const canCoordinate = task.taskManagerId === currentUserId || ["PM", "OWNER", "ADMIN", "CEO"].includes(role);
  const canLegal = ["LEGAL", "OWNER", "ADMIN", "CEO"].includes(role);
  const canProcurement = ["PROCUREMENT", "OWNER", "ADMIN", "CEO"].includes(role);
  const canInspect = ["QAQC", "ENGINEER", "OWNER", "ADMIN", "CEO"].includes(role);

  const nextStages = task.stages.filter((s) => task.currentStage && s.sequence > task.currentStage.sequence);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-ink">{task.title}</h1>
            <Badge status={task.orchestrationStatus ?? undefined}>{(task.orchestrationStatus ?? "").replace(/_/g, " ")}</Badge>
          </div>
          <p className="text-sm text-ink-faint mt-0.5">
            {task.code} {task.locationDetail ? `· ${task.locationDetail}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/tasks/${task.id}/export`} target="_blank">
            <Button variant="secondary" size="sm">
              <FileDown size={14} /> {t("orchestration.exportPdf")}
            </Button>
          </Link>
          {task.orchestrationStatus === "COMPLETED" && canCoordinate && <ReopenTaskDialog taskId={task.id} trigger={<Button variant="secondary" size="sm">{t("orchestration.reopenTask")}</Button>} />}
          {task.orchestrationStatus !== "COMPLETED" && canCoordinate && (
            <CompleteTaskDialog taskId={task.id} blockers={gate.blockers} trigger={<Button size="sm">{t("orchestration.completeTask")}</Button>} />
          )}
        </div>
      </div>

      {!gate.canComplete && task.orchestrationStatus !== "COMPLETED" && gate.blockers.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-xs text-warning">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>
            {t("orchestration.outstandingGates")}: {gate.blockers.join(" · ")}
          </span>
        </div>
      )}

      <Tabs.Root defaultValue="overview">
        <Tabs.List className="flex flex-wrap gap-1 border-b border-border pb-px">
          {[
            ["overview", t("orchestration.tabOverview")],
            ["workflow", t("orchestration.tabWorkflow")],
            ["departments", t("orchestration.tabDepartments")],
            ["approvals", t("orchestration.tabApprovals")],
            ["files", t("nav.documents")],
            ["contracts", t("orchestration.tabContracts")],
            ["inspections", t("orchestration.tabInspections")],
            ["timeline", t("orchestration.tabTimeline")],
            ["comments", t("orchestration.tabComments")],
            ["related", t("orchestration.tabRelated")],
          ].map(([value, label]) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className="px-3 py-2 text-sm text-ink-muted border-b-2 border-transparent data-[state=active]:border-gold data-[state=active]:text-ink hover:text-ink"
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="overview" className="pt-4">
          <OverviewTab task={task} />
        </Tabs.Content>

        <Tabs.Content value="workflow" className="pt-4 space-y-4">
          <Card>
            <CardContent className="pt-5">
              <ol className="space-y-2">
                {task.stages.map((stage) => {
                  const Icon = STAGE_ICON[stage.status as keyof typeof STAGE_ICON] ?? Circle;
                  const isCurrent = task.currentStageId === stage.id;
                  return (
                    <li key={stage.id} className={`flex items-start gap-3 rounded-lg p-2.5 ${isCurrent ? "bg-gold-soft" : ""}`}>
                      <Icon
                        size={16}
                        className={`shrink-0 mt-0.5 ${
                          stage.status === "COMPLETED" ? "text-success" : stage.status === "SKIPPED" ? "text-ink-faint" : stage.status === "REJECTED" ? "text-danger" : isCurrent ? "text-gold" : "text-ink-faint"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${isCurrent ? "font-semibold text-ink" : "text-ink-muted"}`}>{stage.label}</p>
                        {stage.status === "SKIPPED" && stage.skipReason && <p className="text-xs text-ink-faint">{t("orchestration.skipped")}: {stage.skipReason}</p>}
                        {stage.completedAt && <p className="text-xs text-ink-faint">{formatDate(stage.completedAt)}</p>}
                      </div>
                      <Badge status={stage.status} className="shrink-0">
                        {stage.status}
                      </Badge>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
          {canCoordinate && nextStages.length > 0 && (
            <StageTransitionControl taskId={task.id} currentSequence={task.currentStage?.sequence ?? 0} nextStages={nextStages} />
          )}
        </Tabs.Content>

        <Tabs.Content value="departments" className="pt-4 space-y-4">
          <div className="flex flex-wrap gap-2 justify-end">
            {canCoordinate && <ActivateDepartmentDialog taskId={task.id} members={members} trigger={<Button size="sm">{t("orchestration.activateDepartment")}</Button>} />}
            <RequestInvolvementDialog taskId={task.id} trigger={<Button size="sm" variant="secondary">{t("orchestration.requestInvolvement")}</Button>} />
          </div>
          {task.departments.map((dept) => (
            <DepartmentCard key={dept.id} dept={dept} taskId={task.id} currentUserId={currentUserId} canApprove={canCoordinate} />
          ))}
          {task.involvementRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("orchestration.involvementRequests")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {task.involvementRequests.map((req) => (
                  <InvolvementRequestRow key={req.id} req={req} taskId={task.id} members={members} canRespond={canCoordinate} />
                ))}
              </CardContent>
            </Card>
          )}
        </Tabs.Content>

        <Tabs.Content value="approvals" className="pt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <TRow>
                    <TH>{t("orchestration.approver")}</TH>
                    <TH>{t("orchestration.action")}</TH>
                    <TH>{t("common.comment")}</TH>
                    <TH>{t("dashboards.admin.joined")}</TH>
                  </TRow>
                </THead>
                <TBody>
                  {task.approvals.map((a) => (
                    <TRow key={a.id}>
                      <TD className="font-medium text-ink">{a.approver.displayName}</TD>
                      <TD>
                        <Badge status={a.action}>{a.action.replace(/_/g, " ")}</Badge>
                        {a.action === "APPROVE_WITH_CONDITIONS" && !a.conditionsMet && canCoordinate && (
                          <button
                            className="ml-2 text-xs text-gold hover:underline"
                            onClick={() => markConditionsMetAction({ approvalId: a.id, taskId: task.id }).then(() => router.refresh())}
                          >
                            {t("orchestration.markConditionsMet")}
                          </button>
                        )}
                      </TD>
                      <TD className="text-ink-muted">{a.comment ?? "—"}</TD>
                      <TD className="text-ink-faint">{formatDate(a.createdAt, { hour: "2-digit", minute: "2-digit" })}</TD>
                    </TRow>
                  ))}
                  {task.approvals.length === 0 && (
                    <TRow>
                      <TD colSpan={4} className="text-center text-ink-faint py-8">
                        {t("orchestration.noApprovals")}
                      </TD>
                    </TRow>
                  )}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="files" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("nav.documents")}</CardTitle>
              <CreateDocumentDialog taskId={task.id} triggerLabel={t("documents.newDocument")} />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <TRow>
                    <TH>{t("documents.name")}</TH>
                    <TH>{t("documents.category")}</TH>
                    <TH>{t("common.status")}</TH>
                    <TH>{t("documents.uploadedBy")}</TH>
                  </TRow>
                </THead>
                <TBody>
                  {task.documents.map((doc) => (
                    <TRow key={doc.id}>
                      <TD className="font-medium text-ink">{doc.name}</TD>
                      <TD className="text-ink-muted">{doc.category.replace(/_/g, " ")}</TD>
                      <TD>
                        <Badge status={doc.status}>{doc.status}</Badge>
                      </TD>
                      <TD className="text-ink-muted">{doc.uploadedBy.displayName}</TD>
                    </TRow>
                  ))}
                  {task.documents.length === 0 && (
                    <TRow>
                      <TD colSpan={4} className="text-center text-ink-faint py-8">
                        {t("documents.noDocuments")}
                      </TD>
                    </TRow>
                  )}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="contracts" className="pt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("orchestration.tabContracts")}</CardTitle>
              {canLegal && <LinkContractDialog taskId={task.id} contracts={contracts} trigger={<Button size="sm">{t("orchestration.legalDecision")}</Button>} />}
            </CardHeader>
            <CardContent className="space-y-2">
              {task.contractLinks.map((link) => (
                <div key={link.id} className="flex items-center justify-between rounded-lg bg-surface-sunken/60 p-3 text-sm">
                  <div>
                    <p className="font-medium text-ink">{link.decision.replace(/_/g, " ")}</p>
                    {link.contract && (
                      <p className="text-xs text-ink-muted">
                        {link.contract.number} — {formatCurrency(link.contract.value, link.contract.currency)}
                      </p>
                    )}
                    {link.reason && <p className="text-xs text-ink-faint">{link.reason}</p>}
                  </div>
                  <span className="text-xs text-ink-faint">{formatDate(link.createdAt)}</span>
                </div>
              ))}
              {task.contractLinks.length === 0 && <p className="text-sm text-ink-faint text-center py-4">{t("orchestration.noContractDecision")}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("orchestration.contractorAssignment")}</CardTitle>
              {canProcurement && <AssignContractorDialog taskId={task.id} contractors={contractors} contracts={contracts} trigger={<Button size="sm">{t("orchestration.assignContractor")}</Button>} />}
            </CardHeader>
            <CardContent className="space-y-2">
              {task.contractorAssignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg bg-surface-sunken/60 p-3 text-sm">
                  <div>
                    <p className="font-medium text-ink">{a.contractor.name}</p>
                    <p className="text-xs text-ink-muted">{a.scope}</p>
                  </div>
                  <Badge status={a.status}>{a.status.replace(/_/g, " ")}</Badge>
                </div>
              ))}
              {task.contractorAssignments.length === 0 && <p className="text-sm text-ink-faint text-center py-4">{t("orchestration.noContractorAssigned")}</p>}
            </CardContent>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="inspections" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("orchestration.tabInspections")}</CardTitle>
              {canInspect && <RecordInspectionDialog taskId={task.id} trigger={<Button size="sm">{t("orchestration.recordInspection")}</Button>} />}
            </CardHeader>
            <CardContent className="space-y-2">
              {task.inspections.map((insp) => (
                <div key={insp.id} className="flex items-center justify-between rounded-lg bg-surface-sunken/60 p-3 text-sm">
                  <div>
                    <p className="font-medium text-ink">{insp.result ? insp.result.replace(/_/g, " ") : t("orchestration.pendingInspection")}</p>
                    {insp.notes && <p className="text-xs text-ink-muted">{insp.notes}</p>}
                    {insp.inspector && <p className="text-xs text-ink-faint">{insp.inspector.displayName}</p>}
                  </div>
                  {insp.result ? <Badge status={insp.result}>{insp.result.replace(/_/g, " ")}</Badge> : canInspect && <RecordInspectionDialog taskId={task.id} inspectionId={insp.id} trigger={<Button size="sm" variant="secondary">{t("orchestration.recordInspection")}</Button>} />}
                </div>
              ))}
              {task.inspections.length === 0 && <p className="text-sm text-ink-faint text-center py-4">{t("orchestration.noInspections")}</p>}
            </CardContent>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="timeline" className="pt-4">
          <Card>
            <CardContent className="pt-5">
              <ol className="space-y-4 border-l border-border pl-4">
                {task.events.map((ev) => (
                  <li key={ev.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-gold" />
                    <p className="text-sm text-ink">{ev.summary}</p>
                    <p className="text-xs text-ink-faint">
                      {ev.actor?.displayName ?? t("orchestration.system")} · {formatDate(ev.createdAt, { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </li>
                ))}
                {task.events.length === 0 && <p className="text-sm text-ink-faint">{t("orchestration.noEvents")}</p>}
              </ol>
            </CardContent>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="comments" className="pt-4">
          <Card>
            <CardContent className="pt-5 space-y-4">
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="flex items-start gap-2.5">
                    <Avatar name={c.author.displayName} color={c.author.avatarColor} size={26} />
                    <div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm font-medium text-ink">{c.author.displayName}</p>
                        <p className="text-xs text-ink-faint">{formatDate(c.createdAt, { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <p className="text-sm text-ink-muted whitespace-pre-wrap">{c.body}</p>
                    </div>
                  </li>
                ))}
                {comments.length === 0 && <p className="text-sm text-ink-faint text-center py-4">{t("clients.noComments")}</p>}
              </ul>
              <TaskCommentBox taskId={task.id} />
            </CardContent>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="related" className="pt-4 space-y-4">
          <Card>
            <CardContent className="pt-5 space-y-3 text-sm">
              {task.project && (
                <p>
                  {t("nav.projects")}: <a href={`/projects/${task.project.id}`} className="text-gold hover:underline">{task.project.name}</a>
                </p>
              )}
              {task.client && (
                <p>
                  {t("nav.clients")}: <a href={`/clients/${task.client.id}`} className="text-gold hover:underline">{task.client.name}</a>
                </p>
              )}
              {task.escalations.length > 0 && (
                <div>
                  <p className="font-medium text-ink mb-1.5">{t("orchestration.escalations")}</p>
                  {task.escalations.map((e) => (
                    <p key={e.id} className="text-xs text-ink-muted">
                      {e.fromUser?.displayName ?? "—"} → {e.toUser.displayName}: {e.reason} {e.acknowledgedAt ? `(${t("orchestration.acknowledged")})` : ""}
                    </p>
                  ))}
                </div>
              )}
              {task.delayExplanations.length > 0 && (
                <div>
                  <p className="font-medium text-ink mb-1.5">{t("orchestration.delayExplanations")}</p>
                  {task.delayExplanations.map((d) => (
                    <p key={d.id} className="text-xs text-ink-muted">
                      {d.cause} — {d.progressPct}% — {t("orchestration.newExpectedDate")}: {formatDate(d.newExpectedDate)}
                    </p>
                  ))}
                </div>
              )}
              {canCoordinate && (
                <div className="pt-2">
                  <EscalateDialog taskId={task.id} members={members} trigger={<Button size="sm" variant="secondary">{t("orchestration.escalate")}</Button>} />
                  <span className="inline-block w-2" />
                  <ExplainDelayDialog taskId={task.id} trigger={<Button size="sm" variant="secondary">{t("orchestration.explainDelay")}</Button>} />
                </div>
              )}
            </CardContent>
          </Card>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

function OverviewTab({ task }: { task: TaskOrchestrationData }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{t("orchestration.tabOverview")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-muted whitespace-pre-wrap">{task.description ?? "—"}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("orchestration.responsibility")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-ink-faint">{t("orchestration.taskManager")}: </span>
            {task.taskManager?.displayName ?? "—"}
          </p>
          <p>
            <span className="text-ink-faint">{t("orchestration.currentStage")}: </span>
            {task.currentStage?.label ?? "—"}
          </p>
          <p>
            <span className="text-ink-faint">{t("task.priority")}: </span>
            {task.priority}
          </p>
          {task.severity && (
            <p>
              <span className="text-ink-faint">{t("orchestration.severity")}: </span>
              {task.severity}
            </p>
          )}
          {task.dueDate && (
            <p>
              <span className="text-ink-faint">{t("common.dueDate")}: </span>
              {formatDate(task.dueDate)}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StageTransitionControl({
  taskId,
  currentSequence,
  nextStages,
}: {
  taskId: string;
  currentSequence: number;
  nextStages: TaskOrchestrationData["stages"];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [toStageKey, setToStageKey] = useState(nextStages[0]?.key ?? "");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const target = nextStages.find((s) => s.key === toStageKey);
  const willSkip = target && target.sequence > currentSequence + 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("orchestration.advanceStage")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <select
          value={toStageKey}
          onChange={(e) => setToStageKey(e.target.value)}
          className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        >
          {nextStages.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        {willSkip && <Textarea rows={2} placeholder={t("orchestration.skipReasonPlaceholder")} value={reason} onChange={(e) => setReason(e.target.value)} />}
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button
          size="sm"
          disabled={pending || (!!willSkip && !reason)}
          onClick={() =>
            startTransition(async () => {
              const result = await transitionStageAction({ taskId, toStageKey, reason: reason || undefined });
              if (result?.error) setError(result.error);
              else router.refresh();
            })
          }
        >
          <ChevronRight size={14} /> {t("orchestration.advance")}
        </Button>
      </CardContent>
    </Card>
  );
}

function DepartmentCard({
  dept,
  taskId,
  currentUserId,
  canApprove,
}: {
  dept: TaskOrchestrationData["departments"][number];
  taskId: string;
  currentUserId: string;
  canApprove: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [approvalComment, setApprovalComment] = useState("");

  const d = dept.deliverable;
  const isOwner = dept.ownerId === currentUserId;
  const canSubmit = isOwner && d && (d.status === "ACTIVE" || d.status === "REVISION_REQUIRED");
  const canReviewThis = canApprove && !isOwner && d && (d.status === "SUBMITTED" || d.status === "UNDER_REVIEW");

  function act(fn: () => Promise<{ error: string } | undefined>) {
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
      else {
        setError(null);
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{DEPARTMENT_LABELS[dept.department as keyof typeof DEPARTMENT_LABELS] ?? dept.department}</CardTitle>
          <CardDescription>{dept.owner.displayName}</CardDescription>
        </div>
        {d && <Badge status={d.status}>{d.status.replace(/_/g, " ")}</Badge>}
      </CardHeader>
      <CardContent className="space-y-3">
        {d ? (
          <>
            <p className="text-sm text-ink-muted">{d.requiredAction}</p>
            {d.expectedOutput && <p className="text-xs text-ink-faint">{d.expectedOutput}</p>}
            {d.deadline && (
              <p className="text-xs text-ink-faint">
                {t("common.dueDate")}: {formatDate(d.deadline)}
              </p>
            )}
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex flex-wrap gap-2">
              {canSubmit && (
                <Button size="sm" disabled={pending} onClick={() => act(() => submitDeliverableAction({ deliverableId: d.id, taskId }))}>
                  {t("orchestration.submit")}
                </Button>
              )}
              {isOwner && dept.isMandatory === false && d.status !== "NOT_REQUIRED" && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => act(() => markNotRequiredAction({ deliverableId: d.id, taskId, reason: "Not applicable to this task" }))}
                >
                  {t("orchestration.notRequired")}
                </Button>
              )}
            </div>
            {canReviewThis && (
              <div className="space-y-2 rounded-lg bg-surface-sunken/60 p-3">
                <Textarea rows={2} placeholder={t("common.comment")} value={approvalComment} onChange={(e) => setApprovalComment(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  {APPROVAL_ACTIONS.filter((a) => a !== "DELEGATE" && a !== "APPROVE_WITH_CONDITIONS").map((action) => (
                    <Button
                      key={action}
                      size="sm"
                      variant={action === "APPROVE" ? "primary" : "secondary"}
                      disabled={pending}
                      onClick={() => act(() => recordApprovalAction({ taskId, deliverableId: d.id, action, comment: approvalComment || undefined }))}
                    >
                      {action.replace(/_/g, " ")}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-ink-faint">{t("orchestration.noDeliverable")}</p>
        )}
      </CardContent>
    </Card>
  );
}

function InvolvementRequestRow({
  req,
  taskId,
  members,
  canRespond,
}: {
  req: TaskOrchestrationData["involvementRequests"][number];
  taskId: string;
  members: Member[];
  canRespond: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ownerId, setOwnerId] = useState("");
  const [showRespond, setShowRespond] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (req.status !== "PENDING") {
    return (
      <div className="rounded-lg bg-surface-sunken/60 p-3 text-sm">
        <p className="text-ink">
          {DEPARTMENT_LABELS[req.department as keyof typeof DEPARTMENT_LABELS] ?? req.department} — {req.reason}
        </p>
        <p className="text-xs text-ink-faint mt-1">
          {req.requestedBy.displayName} → <Badge status={req.status}>{req.status.replace(/_/g, " ")}</Badge>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-surface-sunken/60 p-3 space-y-2">
      <p className="text-sm text-ink">
        {DEPARTMENT_LABELS[req.department as keyof typeof DEPARTMENT_LABELS] ?? req.department} — {req.reason}
      </p>
      <p className="text-xs text-ink-faint">{req.requestedBy.displayName}</p>
      {canRespond && !showRespond && (
        <Button size="sm" variant="secondary" onClick={() => setShowRespond(true)}>
          {t("orchestration.respond")}
        </Button>
      )}
      {canRespond && showRespond && (
        <div className="space-y-2">
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs text-ink"
          >
            <option value="">{t("orchestration.selectOwnerToActivate")}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={pending || !ownerId}
              onClick={() =>
                startTransition(async () => {
                  const result = await respondInvolvementAction({
                    requestId: req.id,
                    taskId,
                    status: "ACTION_REQUIRED",
                    ownerId,
                    requiredAction: req.requestedAction || req.reason,
                  });
                  if (result?.error) setError(result.error);
                  else router.refresh();
                })
              }
            >
              {t("orchestration.activate")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await respondInvolvementAction({ requestId: req.id, taskId, status: "NOT_REQUIRED", response: "Not applicable" });
                  if (result?.error) setError(result.error);
                  else router.refresh();
                })
              }
            >
              {t("orchestration.notRequired")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCommentBox({ taskId }: { taskId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2 pt-3 border-t border-border">
      <Textarea rows={2} placeholder={t("clients.commentPlaceholder")} value={body} onChange={(e) => setBody(e.target.value)} />
      <Button
        size="sm"
        disabled={pending || !body.trim()}
        onClick={() =>
          startTransition(async () => {
            const formData = new FormData();
            formData.set("taskId", taskId);
            formData.set("body", body);
            await createTaskCommentAction(undefined, formData);
            setBody("");
            router.refresh();
          })
        }
      >
        {t("clients.postComment")}
      </Button>
    </div>
  );
}
