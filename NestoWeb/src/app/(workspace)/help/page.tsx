import { Rocket, ShieldCheck, Mail, Keyboard, MessageSquarePlus } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SuggestionForm } from "@/components/help/suggestion-form";
import { listMySuggestions } from "@/server/suggestions";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { getHelpContent } from "@/lib/i18n/help-content";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@/lib/constants";

export default async function HelpPage() {
  const { tenantId, role, user } = await getCurrentUser();
  const { t, locale } = await getT();
  const help = getHelpContent(locale);
  const mySuggestions = await listMySuggestions(tenantId, user.id);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("help.title")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("help.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <Rocket size={18} className="text-gold" />
            <CardTitle>{t("help.gettingStarted")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 list-decimal list-inside">
            {help.gettingStarted.map((point, i) => (
              <li key={i} className="text-sm text-ink-muted leading-relaxed">
                {point}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("help.roleGuides")}</CardTitle>
            <CardDescription>{t("help.roleGuidesDesc")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {help.roleGuides.map((guide) => (
            <div key={guide.role} className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <p className="font-medium text-ink">{guide.title}</p>
                {guide.role === role && <Badge tone="info">{ROLE_LABELS[role as Role]}</Badge>}
              </div>
              <ul className="space-y-1.5">
                {guide.points.map((point, i) => (
                  <li key={i} className="text-sm text-ink-muted leading-relaxed flex gap-2">
                    <span className="text-gold shrink-0">•</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("help.faq")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {help.faq.map((item, i) => (
            <div key={i} className={i > 0 ? "pt-4 border-t border-border" : ""}>
              <p className="text-sm font-medium text-ink">{item.q}</p>
              <p className="text-sm text-ink-muted mt-1 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <MessageSquarePlus size={18} className="text-gold" />
            <div>
              <CardTitle>{t("help.suggestionTitle")}</CardTitle>
              <CardDescription>{t("help.suggestionDesc")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <SuggestionForm />

          {mySuggestions.length > 0 && (
            <div className="pt-4 border-t border-border space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("help.yourSuggestions")}</p>
              <ul className="space-y-2.5">
                {mySuggestions.map((s) => (
                  <li key={s.id} className="text-sm">
                    <p className="text-ink-muted leading-relaxed">{s.message}</p>
                    <p className="text-xs text-ink-faint mt-0.5">{formatDate(s.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex items-start gap-3 pt-5">
            <ShieldCheck size={20} className="text-gold shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-ink text-sm">{t("help.security")}</p>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed">{t("help.securityDesc")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 pt-5">
            <Mail size={20} className="text-gold shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-ink text-sm">{t("help.contactSupport")}</p>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed">{t("help.contactSupportDesc")}</p>
              <p className="text-xs text-gold mt-1.5 font-medium">{t("help.contactEmail")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-3 text-xs text-ink-faint">
        <Keyboard size={14} className="shrink-0 mt-0.5" />
        <p>{t("help.keyboardNote")}</p>
      </div>
    </div>
  );
}
