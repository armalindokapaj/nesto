import { redirect } from "next/navigation";
import Link from "next/link";
import { X, BadgeCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listDocuments } from "@/server/documents";
import { listProjects } from "@/server/projects";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateDocumentDialog } from "@/components/documents/create-document-dialog";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ taskId?: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const canCreate = can(role, "PROJECTS", "WRITE");

  const { taskId } = await searchParams;
  const [allDocuments, projects] = await Promise.all([listDocuments(tenantId), listProjects(tenantId)]);
  const documents = taskId ? allDocuments.filter((d) => d.taskId === taskId) : allDocuments;
  const filteredTaskTitle = taskId ? documents[0]?.task?.title : undefined;
  const { t } = await getT();

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

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("documents.title")}</CardTitle>
            <CardDescription>{t("documents.subtitle")}</CardDescription>
          </div>
          {canCreate && <CreateDocumentDialog projects={projects.map((p) => ({ id: p.id, name: p.name }))} />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("documents.name")}</TH>
                <TH>{t("documents.category")}</TH>
                <TH>{t("common.project")}</TH>
                <TH>{t("nav.tasks")}</TH>
                <TH>{t("documents.version")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("documents.uploadedBy")}</TH>
                <TH>{t("dashboards.admin.joined")}</TH>
              </TRow>
            </THead>
            <TBody>
              {documents.map((doc) => (
                <TRow key={doc.id}>
                  <TD className="font-medium text-ink">
                    <Link href={`/documents/${doc.id}`} className="inline-flex items-center gap-1.5 hover:text-gold hover:underline">
                      {doc.name}
                      {doc.approvedAt && <BadgeCheck size={13} className="text-info" aria-label={t("documents.blueTicket")} />}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{doc.category}</TD>
                  <TD className="text-ink-muted">
                    {doc.project ? (
                      <Link href={`/projects/${doc.project.id}`} className="hover:text-gold hover:underline">
                        {doc.project.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD className="text-ink-muted">
                    {doc.task ? (
                      <Link href={`/documents?taskId=${doc.task.id}`} className="hover:text-gold hover:underline">
                        {doc.task.title}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD className="text-ink-muted">v{doc.version}</TD>
                  <TD>
                    <Badge status={doc.status}>{doc.status}</Badge>
                  </TD>
                  <TD className="text-ink-muted">{doc.uploadedBy.displayName}</TD>
                  <TD className="text-ink-muted">{formatDate(doc.createdAt)}</TD>
                </TRow>
              ))}
              {documents.length === 0 && (
                <TRow>
                  <TD colSpan={8} className="text-center text-ink-faint py-8">
                    {t("documents.noDocuments")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-ink-faint px-1">{t("documents.note")}</p>
    </div>
  );
}
