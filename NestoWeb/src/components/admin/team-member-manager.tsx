"use client";

import { useActionState, useTransition } from "react";
import { X } from "lucide-react";
import {
  addTeamMemberAction,
  updateTeamMemberRoleAction,
  removeTeamMemberAction,
} from "@/app/actions/teams-module";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { TEAM_ROLES } from "@/lib/team-constants";
import { useI18n } from "@/lib/i18n/locale-provider";

export type TeamMemberRow = {
  userId: string;
  displayName: string;
  avatarColor: string | null;
  role: string;
  isLead: boolean;
};

// §6 Team Roles — describes responsibility within the team; §37 Data
// Ownership Rules — adding/removing membership here never touches
// employment, task access or document access.
export function TeamMemberManager({
  teamId,
  members,
  candidates,
}: {
  teamId: string;
  members: TeamMemberRow[];
  candidates: { id: string; displayName: string }[];
}) {
  const { t } = useI18n();
  const [, formAction, pending] = useActionState(addTeamMemberAction, undefined);
  const [isPending, startTransition] = useTransition();

  const memberIds = new Set(members.map((m) => m.userId));
  const available = candidates.filter((c) => !memberIds.has(c.id));

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-surface-sunken">
            <Avatar name={m.displayName} color={m.avatarColor ?? undefined} size={28} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">
                {m.displayName}
                {m.isLead && (
                  <span className="ml-1.5 rounded-full bg-gold/10 px-1.5 py-px text-[10px] font-medium text-gold-deep">
                    {t("teamsModule.lead")}
                  </span>
                )}
              </p>
            </div>
            <select
              defaultValue={m.role}
              disabled={isPending}
              onChange={(e) => startTransition(() => updateTeamMemberRoleAction(teamId, m.userId, e.target.value))}
              className="h-8 rounded-lg border border-border bg-surface px-2 text-xs text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            >
              {TEAM_ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`teamsModule.role_${r}`)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(() => removeTeamMemberAction(teamId, m.userId))}
              className="shrink-0 text-ink-faint hover:text-danger"
              aria-label={t("common.remove")}
            >
              <X size={14} />
            </button>
          </li>
        ))}
        {members.length === 0 && <p className="text-xs text-ink-faint">{t("teamsModule.noMembers")}</p>}
      </ul>

      {available.length > 0 && (
        <form action={formAction} className="flex items-center gap-1.5 border-t border-border pt-3">
          <input type="hidden" name="teamId" value={teamId} />
          <select
            name="userId"
            defaultValue=""
            required
            className="h-8 flex-1 rounded-lg border border-border bg-surface px-2 text-xs text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          >
            <option value="" disabled>
              {t("teamsModule.addMember")}
            </option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            {t("teamsModule.addMember")}
          </Button>
        </form>
      )}
    </div>
  );
}
