import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateMeetingDialog } from "@/components/meetings/create-meeting-dialog";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

type Meeting = { id: string; title: string; scheduledAt: Date; location: string | null; status: string; organiser: { displayName: string } };

const MEETING_STATUS_KEY: Record<string, string> = {
  PLANNED: "meetings.planned",
  HELD: "meetings.held",
  CANCELLED: "meetings.cancelled",
};

export async function MeetingList({ projectId, meetings, canManage }: { projectId: string; meetings: Meeting[]; canManage: boolean }) {
  const { t } = await getT();

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("nav.meetings")}</CardTitle>
          <CardDescription>{t("meetings.projectSubtitle")}</CardDescription>
        </div>
        {canManage && <CreateMeetingDialog projectId={projectId} />}
      </CardHeader>
      <CardContent className="space-y-2">
        {meetings.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-faint">{t("meetings.noMeetings")}</p>
        ) : (
          meetings.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{m.title}</p>
                <p className="text-xs text-ink-muted">
                  {formatDate(m.scheduledAt)}
                  {m.location ? ` · ${m.location}` : ""} · {m.organiser.displayName}
                </p>
              </div>
              <Badge status={m.status}>{t(MEETING_STATUS_KEY[m.status] ?? m.status)}</Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
