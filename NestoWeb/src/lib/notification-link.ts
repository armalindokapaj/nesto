/**
 * Where a notification takes you when it is clicked, and how the destination
 * knows which notification sent you there.
 *
 * Every notification carries an optional `link` — the page where the thing it
 * is telling you about actually gets resolved (`/tasks/abc`, `/documents/xyz`).
 * Clicking one navigates there with `?highlight=<notification id>` appended,
 * which the workspace shell picks up to spotlight what you were sent for
 * before you click anything else (see notification-spotlight.tsx).
 *
 * A notification with no link has nowhere to be solved, so it falls back to the
 * notification centre, where the same `highlight` param rings its own row.
 */
export const HIGHLIGHT_PARAM = "highlight";

export const NOTIFICATION_CENTRE = "/notifications";

export function notificationHref(link: string | null | undefined, id: string) {
  const base = link && link.trim() ? link : NOTIFICATION_CENTRE;
  const [path, existingQuery] = base.split("#")[0].split("?");
  const hash = base.includes("#") ? `#${base.split("#")[1]}` : "";
  const params = new URLSearchParams(existingQuery ?? "");
  params.set(HIGHLIGHT_PARAM, id);
  return `${path}?${params.toString()}${hash}`;
}
