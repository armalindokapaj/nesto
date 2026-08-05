import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listTeams } from "@/server/admin";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { CreateTeamDialog } from "@/components/admin/create-team-dialog";
import { getT } from "@/lib/i18n/server";

export default async function AdminTeamsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "USER_MANAGEMENT", "READ")) redirect("/dashboard/executive");
  const canCreate = can(role, "USER_MANAGEMENT", "FULL");

  const teams = await listTeams(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("admin_sub.teamsTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("admin_sub.teamsSubtitle")}</p>
        </div>
        {canCreate && <CreateTeamDialog />}
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-ink-faint">{t("admin_sub.noTeams")}</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <Card key={team.id}>
              <CardHeader>
                <div className="min-w-0">
                  <Link href={`/dashboard/admin/teams/${team.id}`} className="hover:text-gold">
                    <CardTitle className="truncate">{team.name}</CardTitle>
                  </Link>
                  {team.description && <CardDescription>{team.description}</CardDescription>}
                </div>
                {team.teamType && (
                  <Badge tone="neutral" className="shrink-0">
                    {team.teamType}
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                {team.members.length === 0 ? (
                  <p className="text-sm text-ink-faint">{t("dashboards.admin.noMembers")}</p>
                ) : (
                  <ul className="space-y-2.5">
                    {team.members.map((m) => (
                      <li key={m.id} className="flex items-center gap-2.5">
                        <Avatar name={m.user.displayName} color={m.user.avatarColor} size={26} />
                        <p className="text-sm text-ink truncate">{m.user.displayName}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
