import { getT } from "@/lib/i18n/server";
import type { Role } from "@/lib/constants";

// A "Good morning, X Team — here's what's happening with Y today" header,
// consistent across every dashboard. `greetingRole` is the role whose work
// the greeting speaks to — for shared shells (executive, architect) that's
// the actual viewer's role, since those consoles are used by several
// meaningfully different roles; for single-department consoles (finance, hr,
// procurement, admin, contractor) it's fixed to that department regardless
// of which elevated role is browsing in.
export async function DashboardGreeting({ greetingRole }: { greetingRole: Role }) {
  const { t } = await getT();
  return (
    <div>
      <h1 className="text-xl font-semibold text-ink">{t(`dashboards.greeting.${greetingRole}`)}</h1>
      <p className="text-sm text-ink-muted mt-0.5">{t(`dashboards.greetingSubtitle.${greetingRole}`)}</p>
    </div>
  );
}
