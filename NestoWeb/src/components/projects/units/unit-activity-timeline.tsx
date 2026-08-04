import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

type ActivityEvent = { id: string; eventType: string; summary: string; createdAt: Date; actor: { displayName: string; avatarColor: string } };

// PRD_Unit_Page §15 — Pass 1's thin event set (UNIT_CREATED/UPDATED/
// STATUS_CHANGED/ARCHIVED/RESTORED). Pass 2 adds sales/payment/handover/
// split/merge event types onto the same UnitActivityEvent model — no schema
// change needed there, just more `eventType` values and log call sites.
export async function UnitActivityTimeline({ events }: { events: ActivityEvent[] }) {
  const { t } = await getT();

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("units.activityTimeline")}</CardTitle>
          <CardDescription>{t("units.activityTimelineSubtitle")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {events.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-faint">{t("units.noActivity")}</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2">
              <Avatar name={event.actor.displayName} color={event.actor.avatarColor} size={22} />
              <div className="min-w-0">
                <p className="text-sm text-ink">{event.summary}</p>
                <p className="text-xs text-ink-faint">
                  {event.actor.displayName} · {formatDate(event.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
