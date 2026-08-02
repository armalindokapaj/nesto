"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { AtSign, Building2, User as UserIcon, X } from "lucide-react";
import { createClientCommentAction } from "@/app/actions/clients";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { DEPARTMENT_ROLES, DEPARTMENT_LABELS } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/locale-provider";

type Member = { id: string; displayName: string };
type Mention = { type: "USER"; id: string; label: string } | { type: "DEPARTMENT"; id: string; label: string };

export function MentionCommentComposer({
  clientId,
  members,
  canCreateTask,
}: {
  clientId: string;
  members: Member[];
  canCreateTask: boolean;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(createClientCommentAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [createTask, setCreateTask] = useState(true);

  const departmentResults = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return DEPARTMENT_ROLES.filter(
      (role) => DEPARTMENT_LABELS[role].toLowerCase().includes(q) && !mentions.some((m) => m.type === "DEPARTMENT" && m.id === role)
    );
  }, [query, mentions]);

  const userResults = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return members.filter(
      (m) => m.displayName.toLowerCase().includes(q) && !mentions.some((mm) => mm.type === "USER" && mm.id === m.id)
    );
  }, [query, members, mentions]);

  const showDropdown = query !== null && (departmentResults.length > 0 || userResults.length > 0);

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setBody(value);

    const cursor = e.target.selectionStart;
    const upToCursor = value.slice(0, cursor);
    const atIndex = upToCursor.lastIndexOf("@");
    if (atIndex === -1) {
      setQuery(null);
      return;
    }
    const afterAt = upToCursor.slice(atIndex + 1);
    if (/\s/.test(afterAt)) {
      setQuery(null);
      return;
    }
    setQuery(afterAt);
  }

  function insertMention(mention: Mention) {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? body.length;
    const upToCursor = body.slice(0, cursor);
    const atIndex = upToCursor.lastIndexOf("@");
    if (atIndex === -1) return;

    const before = body.slice(0, atIndex);
    const after = body.slice(cursor);
    const inserted = `@${mention.label} `;
    setBody(before + inserted + after);
    setMentions((prev) => [...prev, mention]);
    setQuery(null);

    requestAnimationFrame(() => {
      textarea?.focus();
      const pos = (before + inserted).length;
      textarea?.setSelectionRange(pos, pos);
    });
  }

  function removeMention(mention: Mention) {
    setMentions((prev) => prev.filter((m) => !(m.type === mention.type && m.id === mention.id)));
    setBody((prev) => prev.replace(`@${mention.label} `, "").replace(`@${mention.label}`, ""));
  }

  function reset() {
    setBody("");
    setMentions([]);
    setQuery(null);
    setCreateTask(true);
  }

  const mentionsPayload = mentions.map((m) => (m.type === "USER" ? { type: "USER", userId: m.id } : { type: "DEPARTMENT", role: m.id }));

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        reset();
        formRef.current?.reset();
      }}
      className="space-y-2.5 pt-3 border-t border-border"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="mentions" value={JSON.stringify(mentionsPayload)} />

      <div className="relative">
        <Textarea
          ref={textareaRef}
          name="body"
          rows={3}
          placeholder={t("clients.commentPlaceholder")}
          value={body}
          onChange={handleBodyChange}
          onBlur={() => setTimeout(() => setQuery(null), 150)}
          required
        />
        {showDropdown && (
          <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
            {departmentResults.length > 0 && (
              <div className="p-1.5">
                <p className="px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-ink-faint">
                  {t("clients.mentionDepartments")}
                </p>
                {departmentResults.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertMention({ type: "DEPARTMENT", id: role, label: DEPARTMENT_LABELS[role] })}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-surface-sunken"
                  >
                    <Building2 size={14} className="text-ink-faint shrink-0" />
                    {DEPARTMENT_LABELS[role]}
                  </button>
                ))}
              </div>
            )}
            {userResults.length > 0 && (
              <div className="p-1.5 border-t border-border">
                <p className="px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-ink-faint">
                  {t("clients.mentionUsers")}
                </p>
                {userResults.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertMention({ type: "USER", id: member.id, label: member.displayName })}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-surface-sunken"
                  >
                    <UserIcon size={14} className="text-ink-faint shrink-0" />
                    {member.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mentions.map((m) => (
            <span
              key={`${m.type}-${m.id}`}
              className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-xs font-medium text-gold-strong"
            >
              {m.type === "DEPARTMENT" ? <Building2 size={11} /> : <UserIcon size={11} />}
              {m.label}
              <button type="button" onClick={() => removeMention(m)} className="hover:text-danger">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {mentions.length > 0 && canCreateTask && (
        <div className="rounded-lg border border-border bg-surface-sunken/50 p-3 space-y-3">
          <label className="flex items-center gap-2 text-sm text-ink cursor-pointer select-none">
            <input
              type="checkbox"
              name="createTask"
              value="true"
              checked={createTask}
              onChange={(e) => setCreateTask(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-gold"
            />
            <AtSign size={14} className="text-gold" />
            {t("clients.createTaskForMentions")}
          </label>

          {createTask && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pl-6">
              <div className="space-y-1 sm:col-span-3">
                <Label htmlFor="taskTitle" className="text-[0.65rem]">
                  {t("task.title")}
                </Label>
                <Input id="taskTitle" name="taskTitle" placeholder={body.slice(0, 60) || t("task.title")} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="priority" className="text-[0.65rem]">
                  {t("task.priority")}
                </Label>
                <select
                  id="priority"
                  name="priority"
                  defaultValue="MEDIUM"
                  className="h-8 w-full rounded-lg border border-border bg-surface px-2 text-xs text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                >
                  <option value="LOW">{t("task.low")}</option>
                  <option value="MEDIUM">{t("task.medium")}</option>
                  <option value="HIGH">{t("task.high")}</option>
                  <option value="CRITICAL">{t("task.critical")}</option>
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="dueDate" className="text-[0.65rem]">
                  {t("common.dueDate")}
                </Label>
                <Input id="dueDate" name="dueDate" type="date" className="h-8 text-xs" />
              </div>
            </div>
          )}
        </div>
      )}

      {state?.error && <p className="text-xs text-danger">{state.error}</p>}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? t("common.saving") : t("clients.postComment")}
      </Button>
    </form>
  );
}
