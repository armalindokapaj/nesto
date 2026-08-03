import { db } from "@/lib/db";
import { assertTenant, requireTenantProject } from "@/lib/tenant";

export async function listMeetings(tenantId: string) {
  return db.meeting.findMany({
    where: { tenantId },
    include: { project: true, organiser: true },
    orderBy: { scheduledAt: "desc" },
  });
}

export async function createMeeting(
  tenantId: string,
  input: { title: string; scheduledAt: Date; location?: string; projectId?: string; organiserId: string }
) {
  if (input.projectId) await requireTenantProject(tenantId, input.projectId);
  return db.meeting.create({
    data: {
      tenantId,
      title: input.title,
      scheduledAt: input.scheduledAt,
      location: input.location,
      projectId: input.projectId,
      organiserId: input.organiserId,
    },
  });
}

export async function updateMeetingStatus(tenantId: string, meetingId: string, status: string) {
  const meeting = await db.meeting.findUnique({ where: { id: meetingId } });
  assertTenant(meeting, tenantId, "Meeting");
  return db.meeting.update({ where: { id: meetingId }, data: { status } });
}
