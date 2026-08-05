import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Archive, ArchiveRestore } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getTeamDetail } from "@/server/teams-module";
import { archiveTeamAction, restoreTeamAction } from "@/app/actions/teams-module";
import { listAllMembers } from "@/server/admin";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TeamMemberManager } from "@/components/admin/team-member-manager";
import { TeamSettingsForm } from "@/components/admin/team-settings-form";
import { getT } from "@/lib/i18n/server";

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "USER_MANAGEMENT", "READ")) redirect("/dashboard/executive");
  const canManage = can(role, "USER_MANAGEMENT", "FULL");

  const [team, allMembers] = await Promise.all([getTeamDetail(tenantId, id), listAllMembers(tenantId)]);
  const { t } = await getT();

  const memberRows = team.members.map((m) => ({
    userId: m.userId,
    displayName: m.user.displayName,
    avatarColor: m.user.avatarColor,
    role: m.role,
    isLead: m.userId === team.leadId,
  }));

  return (
    <div className="space-y-6">
      <Link href="/dashboard/admin/teams" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("teamsModule.backToTeams")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-base">{team.name}</CardTitle>
            <CardDescription>
              {team.description || t("teamsModule.noDescription")}
              {team.lead && (
                <>
                  {" · "}
                  {t("teamsModule.lead")}: {team.lead.displayName}
                </>
              )}
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {team.teamType && <Badge tone="neutral">{team.teamType}</Badge>}
            {team.archivedAt ? <Badge tone="neutral">{t("teamsModule.archived")}</Badge> : null}
          </div>
        </CardHeader>
        {canManage && (
          <CardContent>
            <form action={team.archivedAt ? restoreTeamAction.bind(null, team.id) : archiveTeamAction.bind(null, team.id)}>
              <Button type="submit" size="sm" variant="secondary">
                {team.archivedAt ? (
                  <>
                    <ArchiveRestore size={14} /> {t("teamsModule.restore")}
                  </>
                ) : (
                  <>
                    <Archive size={14} /> {t("teamsModule.archive")}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>{t("teamsModule.members")}</CardTitle>
            <span className="text-xs text-ink-faint">{t("teamsModule.membershipNote")}</span>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <TeamMemberManager
                teamId={team.id}
                members={memberRows}
                candidates={allMembers.map((m) => ({ id: m.user.id, displayName: m.user.displayName }))}
              />
            ) : (
              <ul className="space-y-1.5">
                {memberRows.map((m) => (
                  <li key={m.userId} className="text-sm text-ink">
                    {m.displayName} {m.isLead && `(${t("teamsModule.lead")})`}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("teamsModule.settings")}</CardTitle>
            </CardHeader>
            <CardContent>
              {/* React resets uncontrolled fields to their defaultValue after
                  a successful action on a form that stays mounted (§ React 19
                  form-action reset behavior). Keying on the server data
                  forces a remount instead, so a save reflects the fresh
                  value rather than snapping back to how the form looked at
                  first load. */}
              <TeamSettingsForm
                key={`${team.name}-${team.description}-${team.teamType}-${team.leadId}`}
                teamId={team.id}
                name={team.name}
                description={team.description}
                teamType={team.teamType}
                leadId={team.leadId}
                members={memberRows.map((m) => ({ userId: m.userId, displayName: m.displayName }))}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
