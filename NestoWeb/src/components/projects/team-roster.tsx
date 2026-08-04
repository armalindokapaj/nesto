import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { AddMemberDialog } from "@/components/projects/add-member-dialog";
import { RemoveMemberButton } from "@/components/projects/remove-member-button";
import { getT } from "@/lib/i18n/server";

type Member = { userId: string; roleOnProject: string | null; user: { displayName: string; avatarColor: string } };

// PRD_Rework_1 §14 — everyone involved: employees, contractors, consultants
// and client representatives. All are UserIdentity + ProjectMember rows;
// there's no separate "type" to distinguish them, so this is one flat roster.
export async function TeamRoster({
  projectId,
  members,
  candidates,
  canManage,
}: {
  projectId: string;
  members: Member[];
  candidates: { id: string; displayName: string }[];
  canManage: boolean;
}) {
  const { t } = await getT();

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("team.title")}</CardTitle>
          <CardDescription>{t("team.subtitle")}</CardDescription>
        </div>
        {canManage && <AddMemberDialog projectId={projectId} candidates={candidates} />}
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-faint">{t("team.noMembers")}</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={m.user.displayName} color={m.user.avatarColor} size={28} />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{m.user.displayName}</p>
                    {m.roleOnProject && <p className="truncate text-xs text-ink-muted">{m.roleOnProject}</p>}
                  </div>
                </div>
                {canManage && <RemoveMemberButton projectId={projectId} userId={m.userId} />}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
