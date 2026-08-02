import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, User } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getClient } from "@/server/clients";
import { listComments } from "@/server/comments";
import { listAllMembers } from "@/server/admin";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { CreateTaskDialog } from "@/components/projects/create-task-dialog";
import { TaskStatusSelect } from "@/components/projects/task-status-select";
import { DeleteTaskButton } from "@/components/projects/delete-task-button";
import { CreateDocumentDialog } from "@/components/documents/create-document-dialog";
import { ClientComments } from "@/components/clients/client-comments";
import { TASK_STATUS_KEY } from "@/lib/constants";
import type { TaskStatus } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "CLIENTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "CLIENTS", "WRITE");
  const canCreateTask = canWrite && can(role, "TASKS", "WRITE");

  const client = await getClient(tenantId, id);
  const [comments, members] = await Promise.all([
    listComments(tenantId, "Client", id),
    canCreateTask ? listAllMembers(tenantId) : Promise.resolve([]),
  ]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> {t("clients.title")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle>{client.name}</CardTitle>
              <Badge status={client.status}>{t(`clients.${client.status.toLowerCase()}`)}</Badge>
            </div>
            <CardDescription>{client.contactName ?? t("clients.noContactName")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-ink-muted flex items-center gap-1.5">
                <Mail size={13} /> {t("common.email")}
              </p>
              <p className="text-sm font-medium text-ink mt-1">{client.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted flex items-center gap-1.5">
                <Phone size={13} /> {t("contractors.contact")}
              </p>
              <p className="text-sm font-medium text-ink mt-1">{client.phone ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted flex items-center gap-1.5">
                <User size={13} /> {t("nav.projects")}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {client.projects.length === 0 ? (
                  <span className="text-sm text-ink-faint">—</span>
                ) : (
                  client.projects.map((p) => (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="text-xs rounded-full bg-surface-sunken px-2.5 py-1 text-ink-muted hover:text-gold hover:bg-gold-soft"
                    >
                      {p.name}
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("nav.tasks")}</CardTitle>
            <CardDescription>{t("clients.tasksSubtitle")}</CardDescription>
          </div>
          {canCreateTask && (
            <CreateTaskDialog
              clientId={client.id}
              members={members.map((m) => ({ id: m.user.id, displayName: m.user.displayName }))}
            />
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("task.title")}</TH>
                <TH>{t("common.assignee")}</TH>
                <TH>{t("common.status")}</TH>
                <TH></TH>
              </TRow>
            </THead>
            <TBody>
              {client.tasks.map((task) => (
                <TRow key={task.id}>
                  <TD>
                    <p className="font-medium text-ink">{task.title}</p>
                    <p className="text-xs text-ink-faint">{task.code}</p>
                  </TD>
                  <TD>
                    {task.mainResponsible ? (
                      <div className="flex items-center gap-2">
                        <Avatar name={task.mainResponsible.displayName} color={task.mainResponsible.avatarColor} size={22} />
                        <span className="text-sm text-ink-muted">{task.mainResponsible.displayName}</span>
                      </div>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </TD>
                  <TD>
                    {canCreateTask ? (
                      <TaskStatusSelect taskId={task.id} clientId={client.id} status={task.status as TaskStatus} />
                    ) : (
                      <Badge status={task.status}>{t(TASK_STATUS_KEY[task.status as TaskStatus])}</Badge>
                    )}
                  </TD>
                  <TD>{task.createdById === user.id && <DeleteTaskButton taskId={task.id} clientId={client.id} />}</TD>
                </TRow>
              ))}
              {client.tasks.length === 0 && (
                <TRow>
                  <TD colSpan={4} className="text-center text-ink-faint py-8">
                    {t("task.noTasks")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("nav.documents")}</CardTitle>
            <CardDescription>{t("clients.documentsSubtitle")}</CardDescription>
          </div>
          {canWrite && <CreateDocumentDialog clientId={client.id} triggerLabel={t("documents.newDocument")} />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("documents.name")}</TH>
                <TH>{t("documents.category")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("documents.uploadedBy")}</TH>
                <TH>{t("dashboards.admin.joined")}</TH>
              </TRow>
            </THead>
            <TBody>
              {client.documents.map((doc) => (
                <TRow key={doc.id}>
                  <TD className="font-medium text-ink">{doc.name}</TD>
                  <TD className="text-ink-muted">{doc.category}</TD>
                  <TD>
                    <Badge status={doc.status}>{doc.status}</Badge>
                  </TD>
                  <TD className="text-ink-muted">{doc.uploadedBy.displayName}</TD>
                  <TD className="text-ink-muted">{formatDate(doc.createdAt)}</TD>
                </TRow>
              ))}
              {client.documents.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="text-center text-ink-faint py-8">
                    {t("documents.noDocuments")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("clients.commentsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientComments
            clientId={client.id}
            comments={comments.map((c) => ({ ...c, author: { displayName: c.author.displayName, avatarColor: c.author.avatarColor } }))}
            canComment={canWrite}
          />
        </CardContent>
      </Card>
    </div>
  );
}
