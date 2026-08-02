import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listMeetings } from "@/server/meetings";
import { listProjects } from "@/server/projects";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateMeetingDialog } from "@/components/meetings/create-meeting-dialog";
import { MeetingStatusSelect } from "@/components/meetings/meeting-status-select";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const MEETING_STATUS_KEY: Record<string, string> = {
  PLANNED: "meetings.planned",
  HELD: "meetings.held",
  CANCELLED: "meetings.cancelled",
};

export default async function MeetingsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  const canCreate = can(role, "PROJECTS", "WRITE");

  const [meetings, projects] = await Promise.all([listMeetings(tenantId), listProjects(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("meetings.title")}</CardTitle>
            <CardDescription>{t("meetings.subtitle")}</CardDescription>
          </div>
          {canCreate && <CreateMeetingDialog projects={projects.map((p) => ({ id: p.id, name: p.name }))} />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("task.title")}</TH>
                <TH>{t("common.project")}</TH>
                <TH>{t("meetings.scheduled")}</TH>
                <TH>{t("meetings.location")}</TH>
                <TH>{t("meetings.organiser")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {meetings.map((meeting) => (
                <TRow key={meeting.id}>
                  <TD className="font-medium text-ink">{meeting.title}</TD>
                  <TD className="text-ink-muted">
                    {meeting.project ? (
                      <Link href={`/projects/${meeting.project.id}`} className="hover:text-gold hover:underline">
                        {meeting.project.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD className="text-ink-muted">{formatDate(meeting.scheduledAt, { hour: "2-digit", minute: "2-digit" })}</TD>
                  <TD className="text-ink-muted">{meeting.location ?? "—"}</TD>
                  <TD className="text-ink-muted">{meeting.organiser.displayName}</TD>
                  <TD>
                    {canCreate ? (
                      <MeetingStatusSelect meetingId={meeting.id} status={meeting.status} />
                    ) : (
                      <Badge status={meeting.status}>{t(MEETING_STATUS_KEY[meeting.status] ?? meeting.status)}</Badge>
                    )}
                  </TD>
                </TRow>
              ))}
              {meetings.length === 0 && (
                <TRow>
                  <TD colSpan={6} className="text-center text-ink-faint py-8">
                    {t("meetings.noMeetings")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
