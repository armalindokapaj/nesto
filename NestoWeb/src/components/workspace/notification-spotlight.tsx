"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BellRing, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { HIGHLIGHT_PARAM, NOTIFICATION_CENTRE } from "@/lib/notification-link";
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
 * The "and also highlights it" half of a clickable notification.
 *
 * Landing on a task, document or dashboard from a notification otherwise
 * drops you on a full page with no clue which row you were sent for. This sits
 * above the page content on every workspace route, reads `?highlight=<id>`,
 * and restates the notification in a spotlit banner — visible before the user
 * clicks anything — then scrolls itself into view and marks the notification
 * read, since arriving here is the moment it was actually seen.
 *
 * The notification centre is excluded on purpose: that page highlights the
 * notification's own row, so a banner would say the same thing twice.
 */
export function NotificationSpotlight() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const id = searchParams.get(HIGHLIGHT_PARAM);
  const onNotificationCentre = pathname === NOTIFICATION_CENTRE;

  // Keyed by the id it was fetched for, rather than cleared in the effect:
  // a stale banner then simply stops matching the current `?highlight=`,
  // with no synchronous setState reset on every param change.
  const [loaded, setLoaded] = useState<{ id: string; notification: Notification } | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const banner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id || onNotificationCentre) return;
    let active = true;
    fetch(`/api/notifications/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.notification) return;
        setLoaded({ id, notification: data.notification });
        if (!data.notification.isRead) void fetch(`/api/notifications/${id}/read`, { method: "POST" });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id, onNotificationCentre]);

  const notification = loaded && loaded.id === id && id !== dismissedId ? loaded.notification : null;

  useEffect(() => {
    if (notification) banner.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [notification]);

  /** Dropping the param leaves the user on the page they were sent to. */
  function dismiss() {
    setDismissedId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.delete(HIGHLIGHT_PARAM);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  if (!notification) return null;

  return (
    <div
      ref={banner}
      role="status"
      className="notice-spotlight mb-5 flex items-start gap-3 rounded-xl border border-gold/40 bg-gold-soft px-4 py-3.5"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface">
        <BellRing size={16} className="text-gold-strong" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-gold-strong">
          {t("notifications.spotlightLabel")}
        </p>
        <p className="text-sm font-semibold text-ink leading-snug mt-0.5">{notification.title}</p>
        {notification.body && <p className="text-xs text-ink-muted mt-0.5">{notification.body}</p>}
        <p className="text-[0.65rem] text-ink-faint mt-1.5">{formatDate(notification.createdAt)}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("notifications.dismissSpotlight")}
        className="shrink-0 rounded-lg p-1 text-ink-muted hover:bg-surface hover:text-ink transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}
