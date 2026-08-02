"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Calendar, CheckCircle2, FileText, MapPin, Paperclip } from "lucide-react";
import { contractorActionAction } from "@/app/actions/task-orchestration";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";
import type { ContractorActionType } from "@/server/task-orchestration";

type Assignment = {
  id: string;
  status: string;
  scope: string;
  deadline: Date | string | null;
  plannedStart: Date | string | null;
  contract: { id: string; number: string; title: string; status: string } | null;
  task: {
    id: string;
    code: string;
    title: string;
    description: string | null;
    locationDetail: string | null;
    dueDate: Date | string | null;
    documents: { id: string; name: string }[];
  };
};

const NEXT_ACTIONS: Record<string, ContractorActionType[]> = {
  ASSIGNED: ["ACCEPT", "REQUEST_CLARIFICATION"],
  ACCEPTED: ["CONFIRM_START"],
  IN_PROGRESS: ["REPORT_DELAY", "REPORT_READY_FOR_INSPECTION"],
  DELAYED: ["CONFIRM_START", "REPORT_READY_FOR_INSPECTION"],
  REWORK_REQUIRED: ["REPORT_READY_FOR_INSPECTION"],
  CLARIFICATION_REQUESTED: ["ACCEPT"],
};

export function ContractorAssignmentCard({ assignment }: { assignment: Assignment }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [activeAction, setActiveAction] = useState<ContractorActionType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actions = NEXT_ACTIONS[assignment.status] ?? [];
  const readOnly = actions.length === 0;

  function run(action: ContractorActionType) {
    if ((action === "REQUEST_CLARIFICATION" || action === "REPORT_DELAY") && activeAction !== action) {
      setActiveAction(action);
      return;
    }
    startTransition(async () => {
      const result = await contractorActionAction({ assignmentId: assignment.id, taskId: assignment.task.id, action, message: message || undefined });
      if (result?.error) setError(result.error);
      else {
        setError(null);
        setMessage("");
        setActiveAction(null);
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-ink-faint">{assignment.task.code}</p>
          <h3 className="text-sm font-semibold text-ink">{assignment.task.title}</h3>
        </div>
        <Badge status={assignment.status}>{assignment.status.replace(/_/g, " ")}</Badge>
      </div>

      <p className="text-sm text-ink-muted">{assignment.scope}</p>
      {assignment.task.description && <p className="text-xs text-ink-faint">{assignment.task.description}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-ink-muted">
        {assignment.task.locationDetail && (
          <div className="flex items-center gap-1.5">
            <MapPin size={13} className="text-ink-faint" /> {assignment.task.locationDetail}
          </div>
        )}
        {assignment.deadline && (
          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="text-ink-faint" /> {t("orchestration.deadline")}: {formatDate(assignment.deadline)}
          </div>
        )}
        {assignment.contract && (
          <div className="flex items-center gap-1.5">
            <FileText size={13} className="text-ink-faint" /> {assignment.contract.number}
          </div>
        )}
      </div>

      {assignment.task.documents.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {assignment.task.documents.map((d) => (
            <span key={d.id} className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted">
              <Paperclip size={10} /> {d.name}
            </span>
          ))}
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-danger">
          <AlertTriangle size={13} /> {error}
        </p>
      )}

      {!readOnly && activeAction && (
        <div className="space-y-2 rounded-lg bg-surface-sunken/60 p-2.5">
          <Textarea
            rows={2}
            placeholder={t("orchestration.contractorMessagePlaceholder")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={pending} onClick={() => run(activeAction)}>
              {t("orchestration.send")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setActiveAction(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}

      {!readOnly && !activeAction && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button key={action} size="sm" variant={action === "REPORT_READY_FOR_INSPECTION" ? "primary" : "secondary"} disabled={pending} onClick={() => run(action)}>
              {action === "REPORT_READY_FOR_INSPECTION" && <CheckCircle2 size={13} />}
              {t(`orchestration.contractorAction.${action}`)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
