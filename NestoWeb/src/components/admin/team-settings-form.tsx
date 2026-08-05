"use client";

import { useActionState } from "react";
import { updateTeamAction } from "@/app/actions/teams-module";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { SuggestInput } from "@/components/ui/suggest-input";
import { TEAM_TYPE_SUGGESTIONS } from "@/lib/team-constants";
import { useI18n } from "@/lib/i18n/locale-provider";

export function TeamSettingsForm({
  teamId,
  name,
  description,
  teamType,
  leadId,
  members,
}: {
  teamId: string;
  name: string;
  description: string | null;
  teamType: string | null;
  leadId: string | null;
  members: { userId: string; displayName: string }[];
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(updateTeamAction, undefined);

  return (
    <form action={formAction} className="space-y-3.5">
      <input type="hidden" name="teamId" value={teamId} />
      <div className="space-y-1.5">
        <Label htmlFor="team-name">{t("common.name")}</Label>
        <Input id="team-name" name="name" defaultValue={name} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="team-description">{t("common.description")}</Label>
        <Textarea id="team-description" name="description" defaultValue={description ?? ""} rows={2} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="team-type">{t("teamsModule.teamType")}</Label>
        <SuggestInput id="team-type" name="teamType" suggestions={TEAM_TYPE_SUGGESTIONS} defaultValue={teamType ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="team-lead">{t("teamsModule.lead")}</Label>
        <select
          id="team-lead"
          name="leadId"
          defaultValue={leadId ?? ""}
          className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        >
          <option value="">{t("common.none")}</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.displayName}
            </option>
          ))}
        </select>
        <p className="text-xs text-ink-faint">{t("teamsModule.leadMustBeMember")}</p>
      </div>
      {state && "error" in state && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
