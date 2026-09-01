import { getCurrentUser } from "@/lib/dal";
import { listNotifications } from "@/server/notifications";
import { NotificationCentreList } from "@/components/workspace/notification-centre-list";
import { getT } from "@/lib/i18n/server";

/**
 * The notification centre. The bell only ever shows the most recent handful,
 * and emergency alerts already link here (`event-centre.ts`), so this is the
 * page that has to exist for a notification with no page of its own to land
 * somewhere real.
 */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ highlight?: string }>;
}) {
  const { tenantId, user } = await getCurrentUser();
  const [notifications, params, { t }] = await Promise.all([
    listNotifications(tenantId, user.id, 100),
    searchParams,
    getT(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("notifications.title")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("notifications.subtitle")}</p>
      </div>

      <NotificationCentreList
        initialNotifications={notifications.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          link: n.link,
          isRead: n.isRead,
          createdAt: n.createdAt.toISOString(),
        }))}
        highlightId={params.highlight}
      />
    </div>
  );
}
