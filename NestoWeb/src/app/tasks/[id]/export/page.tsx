import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getTaskOrchestration } from "@/server/task-orchestration";
import { DEPARTMENT_LABELS } from "@/lib/constants";
import { PrintButton } from "@/components/projects/print-button";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { formatMinor } from "@/lib/money";

// PRD_4 §16.2's `GET /api/tasks/:taskId/export` and §17.1 rule 17 ("every
// task can export a complete chronological PDF report"). No PDF-generation
// library is set up in this project, so this ships as a real, complete,
// print-optimized page — the browser's native "Print > Save as PDF" produces
// an actual PDF from it — rather than adding a new dependency or faking a
// binary export endpoint that doesn't exist yet.
export default async function TaskExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "TASKS", "READ")) redirect("/dashboard/executive");

  const task = await getTaskOrchestration(tenantId, id);
  const { t } = await getT();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 text-ink print:px-0 print:py-0">
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>

      <div className="no-print mb-6 flex justify-end">
        <PrintButton label={t("orchestration.exportPdf")} />
      </div>

      <header className="border-b border-border pb-4 mb-6">
        <p className="text-xs text-ink-faint">{task.code}</p>
        <h1 className="text-2xl font-serif">{task.title}</h1>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-ink-muted">
          <p>
            {t("common.status")}: <strong className="text-ink">{task.orchestrationStatus}</strong>
          </p>
          <p>
            {t("task.priority")}: <strong className="text-ink">{task.priority}</strong>
          </p>
          <p>
            {t("orchestration.taskManager")}: <strong className="text-ink">{task.taskManager?.displayName ?? "—"}</strong>
          </p>
          <p>
            {t("common.dueDate")}: <strong className="text-ink">{task.dueDate ? formatDate(task.dueDate) : "—"}</strong>
          </p>
        </div>
        {task.locationDetail && <p className="text-xs text-ink-muted mt-1">{task.locationDetail}</p>}
      </header>

      <Section title={t("orchestration.tabWorkflow")}>
        <ol className="space-y-1 text-sm">
          {task.stages.map((s) => (
            <li key={s.id} className="flex justify-between border-b border-border/50 py-1">
              <span>{s.label}</span>
              <span className="text-ink-muted">
                {s.status}
                {s.completedAt ? ` — ${formatDate(s.completedAt)}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title={t("orchestration.tabDepartments")}>
        <table className="w-full text-sm">
          <tbody>
            {task.departments.map((d) => (
              <tr key={d.id} className="border-b border-border/50">
                <td className="py-1.5 pr-3 font-medium">{DEPARTMENT_LABELS[d.department as keyof typeof DEPARTMENT_LABELS] ?? d.department}</td>
                <td className="py-1.5 pr-3 text-ink-muted">{d.owner.displayName}</td>
                <td className="py-1.5 pr-3 text-ink-muted">{d.deliverable?.requiredAction}</td>
                <td className="py-1.5 text-ink-muted">{d.deliverable?.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={t("orchestration.tabApprovals")}>
        <table className="w-full text-sm">
          <tbody>
            {task.approvals.map((a) => (
              <tr key={a.id} className="border-b border-border/50">
                <td className="py-1.5 pr-3 font-medium">{a.approver.displayName}</td>
                <td className="py-1.5 pr-3 text-ink-muted">{a.action.replace(/_/g, " ")}</td>
                <td className="py-1.5 text-ink-muted">{formatDate(a.createdAt, { hour: "2-digit", minute: "2-digit" })}</td>
              </tr>
            ))}
            {task.approvals.length === 0 && (
              <tr>
                <td className="py-1.5 text-ink-faint">{t("orchestration.noApprovals")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      {task.contractLinks.length > 0 && (
        <Section title={t("orchestration.tabContracts")}>
          <table className="w-full text-sm">
            <tbody>
              {task.contractLinks.map((l) => (
                <tr key={l.id} className="border-b border-border/50">
                  <td className="py-1.5 pr-3 font-medium">{l.decision.replace(/_/g, " ")}</td>
                  <td className="py-1.5 pr-3 text-ink-muted">{l.contract ? `${l.contract.number} — ${formatMinor(l.contract.valueMinor, l.contract.currency)}` : "—"}</td>
                  <td className="py-1.5 text-ink-muted">{formatDate(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {task.contractorAssignments.length > 0 && (
        <Section title={t("orchestration.contractorAssignment")}>
          <table className="w-full text-sm">
            <tbody>
              {task.contractorAssignments.map((a) => (
                <tr key={a.id} className="border-b border-border/50">
                  <td className="py-1.5 pr-3 font-medium">{a.contractor.name}</td>
                  <td className="py-1.5 pr-3 text-ink-muted">{a.scope}</td>
                  <td className="py-1.5 text-ink-muted">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {task.inspections.length > 0 && (
        <Section title={t("orchestration.tabInspections")}>
          <table className="w-full text-sm">
            <tbody>
              {task.inspections.map((i) => (
                <tr key={i.id} className="border-b border-border/50">
                  <td className="py-1.5 pr-3 font-medium">{i.result ?? t("orchestration.pendingInspection")}</td>
                  <td className="py-1.5 pr-3 text-ink-muted">{i.inspector?.displayName ?? "—"}</td>
                  <td className="py-1.5 text-ink-muted">{i.inspectedAt ? formatDate(i.inspectedAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title={t("nav.documents")}>
        <ul className="text-sm space-y-1">
          {task.documents.map((doc) => (
            <li key={doc.id} className="flex justify-between border-b border-border/50 py-1">
              <span>
                {doc.name} <span className="text-ink-faint">({doc.category.replace(/_/g, " ")})</span>
              </span>
              <span className="text-ink-muted">v{doc.version} — {doc.status}</span>
            </li>
          ))}
          {task.documents.length === 0 && <li className="text-ink-faint">{t("documents.noDocuments")}</li>}
        </ul>
      </Section>

      <Section title={t("orchestration.tabTimeline")}>
        <ol className="text-sm space-y-1.5">
          {task.events.map((ev) => (
            <li key={ev.id} className="border-b border-border/50 py-1">
              <p>{ev.summary}</p>
              <p className="text-xs text-ink-faint">
                {ev.actor?.displayName ?? t("orchestration.system")} — {formatDate(ev.createdAt, { hour: "2-digit", minute: "2-digit" })}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      {task.completionRecords.length > 0 && (
        <Section title={t("orchestration.completeTask")}>
          {task.completionRecords.map((c) => (
            <div key={c.id} className="text-sm">
              <p>{c.comment}</p>
              <p className="text-xs text-ink-faint">
                {c.completedBy.displayName} — {formatDate(c.actualDate)}
              </p>
            </div>
          ))}
        </Section>
      )}

      <Section title={t("orchestration.approvalRecordTitle")}>
        <p className="text-xs text-ink-faint mb-2">{t("orchestration.approvalRecordNote")}</p>
        <table className="w-full text-sm">
          <tbody>
            {task.approvals
              .filter((a) => a.action === "APPROVE" || a.action === "APPROVE_WITH_CONDITIONS")
              .map((a) => (
                <tr key={a.id} className="border-b border-border/50">
                  <td className="py-1.5 pr-3">{a.approver.displayName}</td>
                  <td className="py-1.5 text-ink-muted">{formatDate(a.createdAt, { hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 break-inside-avoid">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted mb-2">{title}</h2>
      {children}
    </section>
  );
}
