"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Workflow } from "lucide-react";
import { startOrchestrationAction } from "@/app/actions/task-orchestration";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

type Member = { id: string; displayName: string };

export function StartOrchestrationCard({
  taskId,
  taskCode,
  taskTitle,
  canStart,
  members,
}: {
  taskId: string;
  taskCode: string;
  taskTitle: string;
  canStart: boolean;
  members: Member[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [taskManagerId, setTaskManagerId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleStart() {
    if (!taskManagerId) return;
    startTransition(async () => {
      const result = await startOrchestrationAction({ taskId, taskManagerId });
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>
            {taskCode} — {taskTitle}
          </CardTitle>
          <CardDescription>{t("orchestration.notOrchestratedYet")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg bg-surface-sunken/60 p-4">
          <Workflow size={18} className="text-gold shrink-0 mt-0.5" />
          <p className="text-sm text-ink-muted">{t("orchestration.startExplainer")}</p>
        </div>
        {canStart ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
            <div className="space-y-1.5 w-full sm:w-64">
              <Label htmlFor="taskManagerId">{t("orchestration.taskManager")}</Label>
              <select
                id="taskManagerId"
                value={taskManagerId}
                onChange={(e) => setTaskManagerId(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                <option value="">{t("common.select")}</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>
            <Button disabled={!taskManagerId || pending} onClick={handleStart}>
              {pending ? t("common.saving") : t("orchestration.startOrchestration")}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-ink-faint">{t("orchestration.startPermissionDenied")}</p>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}
