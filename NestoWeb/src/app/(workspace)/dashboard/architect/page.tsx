import { redirect } from "next/navigation";
import Link from "next/link";
import { FolderKanban, FileText, HelpCircle, ClipboardCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getArchitectDashboard } from "@/server/architecture";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardGreeting } from "@/components/dashboards/dashboard-greeting";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// PRD_Architect_Dashboard §5 — exact seven-region layout. No Finance/sales/
// generic-KPI content; every region reads directly from source modules
// (Projects/Drawings/RFIs/Submittals/Tasks/Meetings), nothing is duplicated.
export default async function ArchitectDashboardPage() {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");

  const data = await getArchitectDashboard(tenantId, { userId: user.id, role });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <DashboardGreeting greetingRole={role} />

      {/* §6 — exactly four primary cues */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t("dashboards.architect.activeProjects")} value={String(data.cues.activeProjects)} icon={FolderKanban} iconColor="#2457C5" iconBg="#E4ECFB" href="/projects" />
        <StatTile label={t("dashboards.architect.pendingDrawings")} value={String(data.cues.pendingDrawings)} icon={FileText} iconColor="#1A7F4E" iconBg="#E2F4EA" href="/dashboard/architect/drawings?status=pending" />
        <StatTile label={t("dashboards.architect.openRfis")} value={String(data.cues.openRfis)} icon={HelpCircle} iconColor="#B76E00" iconBg="#FBECD2" href="/dashboard/architect/rfis?status=open" />
        <StatTile label={t("dashboards.architect.revisionsAwaiting")} value={String(data.cues.revisionsAwaitingApproval)} icon={ClipboardCheck} iconColor="#4a3aa7" iconBg="#EEEAFB" href="/dashboard/architect/revisions?status=awaiting" />
      </div>

      {/* My Projects */}
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.architect.myProjects")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.myProjects.length === 0 ? (
            <p className="text-sm text-ink-faint py-8 text-center">{t("dashboards.architect.noAssignedProjects")}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.myProjects.map((p) => (
                <Link key={p.id} href={`/dashboard/architect/projects/${p.id}`} className="rounded-xl border border-border p-4 hover:border-gold/60 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-ink truncate">{p.name}</p>
                    <Badge status={p.status}>{p.status}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.attentionChips.openRfis > 0 && <Chip label={`${p.attentionChips.openRfis} RFIs`} />}
                    {p.attentionChips.pendingDrawings > 0 && <Chip label={`${p.attentionChips.pendingDrawings} drawings`} />}
                    {p.attentionChips.revisionsAwaiting > 0 && <Chip label={`${p.attentionChips.revisionsAwaiting} revisions`} />}
                    {p.attentionChips.clientRequests > 0 && <Chip label={`${p.attentionChips.clientRequests} requests`} />}
                    {p.attentionChips.tasks > 0 && <Chip label={`${p.attentionChips.tasks} tasks`} />}
                  </div>
                  {p.nextDeadline && <p className="text-xs text-ink-faint mt-2">{t("dashboards.architect.nextDeadline")}: {formatDate(p.nextDeadline)}</p>}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Needs My Attention */}
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboards.architect.needsMyAttention")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.inbox.length === 0 ? (
              <p className="text-sm text-ink-faint py-8 text-center">{t("dashboards.architect.noAttentionItems")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.inbox.map((item) => (
                  <li key={`${item.type}-${item.id}`}>
                    <Link href={item.href} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-sunken">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{item.title}</p>
                        <p className="text-xs text-ink-muted">{item.type}</p>
                      </div>
                      {item.dueDate && <span className="text-xs text-ink-faint shrink-0">{formatDate(item.dueDate)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Design Status */}
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboards.architect.designStatus")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow label={t("nav.drawings")} counts={data.designStatus.drawings} />
            <StatusRow label={t("nav.revisions")} counts={data.designStatus.revisions} />
            <StatusRow label={t("nav.submittals")} counts={data.designStatus.submittals} />
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">{t("nav.rfis")}</span>
              <span className="text-ink">
                {data.designStatus.rfis.open} {t("dashboards.architect.open")} · {data.designStatus.rfis.overdue} {t("dashboards.architect.overdue")}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming */}
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboards.architect.upcoming")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.upcoming.taskDeadlines.length === 0 && data.upcoming.meetings.length === 0 ? (
              <p className="text-sm text-ink-faint py-4 text-center">{t("dashboards.architect.noUpcoming")}</p>
            ) : (
              <>
                {data.upcoming.taskDeadlines.map((t2) => (
                  <div key={t2.id} className="flex items-center justify-between text-sm">
                    <Link href={`/tasks/${t2.id}`} className="text-ink hover:text-gold truncate">{t2.title}</Link>
                    <span className="text-xs text-ink-muted shrink-0">{t2.dueDate && formatDate(t2.dueDate)}</span>
                  </div>
                ))}
                {data.upcoming.meetings.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <Link href="/calendar" className="text-ink hover:text-gold truncate">{m.title}</Link>
                    <span className="text-xs text-ink-muted shrink-0">{formatDate(m.scheduledAt)}</span>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity — derived from record timestamps, no separate event log */}
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboards.admin.recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-faint py-4 text-center">{t("dashboards.architect.activityHint")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted">{label}</span>;
}

function StatusRow({ label, counts }: { label: string; counts: { status: string; count: number }[] }) {
  if (counts.length === 0) return null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="text-ink">{counts.map((c) => `${c.count} ${c.status.replace("_", " ").toLowerCase()}`).join(" · ")}</span>
    </div>
  );
}
