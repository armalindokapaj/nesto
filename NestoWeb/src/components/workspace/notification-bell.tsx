"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { Bell } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { notificationHref, NOTIFICATION_CENTRE } from "@/lib/notification-link";
import { useI18n } from "@/lib/i18n/locale-provider";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(initialCount);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => {
        setNotifications(data.notifications ?? []);
        setUnread(data.unread ?? 0);
        setLoaded(true);
      });
  }, [open, loaded]);

  async function markAllRead() {
    setUnread(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await fetch("/api/notifications/read-all", { method: "POST" });
  }

  /**
   * Clicking a notification is the whole point of one: it marks itself read
   * and hands you the page where the thing it announced gets solved, with
   * `?highlight=` so the destination can spotlight it on arrival. The read
   * flip is optimistic — navigating is the user-visible job, and a failed
   * mark-read only means the dot is still there next time.
   */
  function openNotification(n: Notification) {
    setOpen(false);
    if (!n.isRead) {
      setUnread((count) => Math.max(0, count - 1));
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)));
      void fetch(`/api/notifications/${n.id}/read`, { method: "POST" });
    }
    router.push(notificationHref(n.link, n.id));
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors"
          aria-label={t("common.notifications")}
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.6rem] font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="w-[340px] max-h-[420px] overflow-y-auto rounded-xl border border-border bg-surface shadow-lg z-50"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-ink">{t("common.notifications")}</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium text-gold hover:underline">
                {t("common.markAllRead")}
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-ink-muted">{t("common.noNotifications")}</p>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li key={n.id} className="border-b border-border last:border-0">
                  <button
                    type="button"
                    onClick={() => openNotification(n)}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:bg-surface-sunken ${
                      n.isRead ? "" : "bg-gold-soft/40"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.isRead && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gold shrink-0" />}
                      <div className={n.isRead ? "opacity-70" : ""}>
                        <p className="text-sm text-ink font-medium leading-snug">{n.title}</p>
                        {n.body && <p className="text-xs text-ink-muted mt-0.5">{n.body}</p>}
                        <p className="text-[0.65rem] text-ink-faint mt-1">{formatDate(n.createdAt)}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border px-4 py-2.5 sticky bottom-0 bg-surface">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(NOTIFICATION_CENTRE);
              }}
              className="text-xs font-medium text-gold hover:underline"
            >
              {t("notifications.viewAll")}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
