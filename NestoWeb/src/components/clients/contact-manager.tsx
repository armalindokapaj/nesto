"use client";

import { useActionState, useTransition } from "react";
import { X } from "lucide-react";
import { addContactAction, removeContactAction } from "@/app/actions/crm-module";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CONTACT_ROLE_SUGGESTIONS } from "@/lib/crm-constants";
import { useI18n } from "@/lib/i18n/locale-provider";

export type ContactRow = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
};

// §15/§16 — one company may have several contacts; role is configurable
// text describing responsibility, not an account/login.
export function ContactManager({ clientId, contacts, canWrite }: { clientId: string; contacts: ContactRow[]; canWrite: boolean }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(addContactAction, undefined);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {contacts.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {c.name}
                {c.role && <span className="ml-1.5 text-xs font-normal text-ink-faint">· {c.role}</span>}
              </p>
              <p className="truncate text-xs text-ink-muted">
                {[c.title, c.email, c.phone].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
            {canWrite && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(() => removeContactAction(c.id, clientId))}
                className="shrink-0 text-ink-faint hover:text-danger"
                aria-label={t("common.remove")}
              >
                <X size={13} />
              </button>
            )}
          </li>
        ))}
        {contacts.length === 0 && <p className="text-xs text-ink-faint">{t("crm.noContacts")}</p>}
      </ul>

      {canWrite && (
        <form action={formAction} className="grid grid-cols-1 gap-2 border-t border-border pt-3 sm:grid-cols-2">
          <input type="hidden" name="clientId" value={clientId} />
          <Input name="name" placeholder={t("crm.contactName")} required />
          <Input name="title" placeholder={t("crm.contactTitle")} />
          <Input name="email" type="email" placeholder={t("common.email")} />
          <Input name="phone" placeholder={t("common.phone")} />
          <select
            name="role"
            defaultValue=""
            className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          >
            <option value="">{t("crm.contactRole")}</option>
            {CONTACT_ROLE_SUGGESTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="secondary" disabled={pending} className="sm:col-span-2">
            {t("crm.addContact")}
          </Button>
          {state && "error" in state && <p className="text-xs text-danger sm:col-span-2">{state.error}</p>}
        </form>
      )}
    </div>
  );
}
