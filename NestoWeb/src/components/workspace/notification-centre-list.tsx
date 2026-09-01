"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BellRing } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { notificationHref } from "@/lib/notification-link";
import { useI18n } from "@/lib/i18n/locale-provider";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

/**
 * The full notification list. Every row is a click target that behaves the
 * same way the bell's rows do — mark read, then open the page where the thing
 * gets solved, carrying `?highlight=` so the destination spotlights it.
 *
 * `highlightId` is this page's own version of that spotlight: a notification
 * with no link lands back here, and the row it sent you to is ringed and
 * scrolled to rather than left for the user to find in the list.
 */
export function NotificationCentreList({
  initialNotifications,
  highlightId,
}: {
  initialNotifications: Notification[];
  highlightId?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const highlighted = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!highlightId) return;
    highlighted.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    // Arriving on the row is the moment it was seen, so it stops counting as
    // unread here and in the header count — the ring is what marks it out now.
    void fetch(`/api/notifications/${highlightId}/read`, { method: "POST" }).then(() =>
      setNotifications((prev) => prev.map((n) => (n.id === highlightId ? { ...n, isRead: true } : n)))
    );
  }, [highlightId]);

  function open(n: Notification) {
    if (!n.isRead) {
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)));
      void fetch(`/api/notifications/${n.id}/read`, { method: "POST" });
    }
    router.push(notificationHref(n.link, n.id));
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await fetch("/api/notifications/read-all", { method: "POST" });
    router.refresh();
  }

  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">
          {unread > 0 ? t("notifications.unreadCount").replace("{count}", String(unread)) : t("common.noNotifications")}
        </p>
        {unread > 0 && (
          <button onClick={markAllRead} className="text-xs font-medium text-gold hover:underline">
            {t("common.markAllRead")}
          </button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgba(26,29,35,0.04)] overflow-hidden">
        {notifications.length === 0 ? (
          <p className="text-sm text-ink-faint py-16 text-center">{t("common.noNotifications")}</p>
        ) : (
          <ul>
            {notifications.map((n) => {
              const isHighlighted = n.id === highlightId;
              return (
                <li
                  key={n.id}
                  ref={isHighlighted ? highlighted : undefined}
                  className={`border-b border-border last:border-0 ${isHighlighted ? "notice-spotlight notice-spotlight-inset relative z-10" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className={`group flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:bg-surface-sunken ${
                      n.isRead ? "" : "bg-gold-soft/40"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
                        n.isRead ? "bg-surface-sunken" : "bg-gold-soft"
                      }`}
                    >
                      <BellRing size={16} className={n.isRead ? "text-ink-faint" : "text-gold-strong"} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm leading-snug ${n.isRead ? "text-ink-muted" : "font-semibold text-ink"}`}>
                        {n.title}
                      </p>
                      {n.body && <p className="text-xs text-ink-muted mt-0.5">{n.body}</p>}
                      <p className="text-[0.65rem] text-ink-faint mt-1">{formatDate(n.createdAt)}</p>
                    </div>
                    <span className="flex items-center gap-1.5 shrink-0 pt-0.5">
                      {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
                      {n.link && (
                        <ArrowUpRight
                          size={14}
                          className="text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
