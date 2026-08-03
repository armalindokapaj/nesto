import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { getOrCreateTenantSettings } from "@/app/actions/tenant-settings";
import { getReminderPreferences } from "@/server/calendar";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { NotificationPreferencesForm } from "@/components/account/notification-preferences-form";
import { ReminderPreferencesForm } from "@/components/account/reminder-preferences-form";
import { ThemeSelector } from "@/components/account/theme-selector";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { TenantSettingsForm } from "@/components/settings/tenant-settings-form";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role, Theme } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";

export default async function AccountPage() {
  const { user, tenantId, membership, role, company } = await getCurrentUser();
  const [preferences, reminderPreferences] = await Promise.all([
    db.notificationPreference.findMany({ where: { userId: user.id } }),
    getReminderPreferences(user.id),
  ]);
  const canManageTenantSettings = can(role as Role, "COMPANY_SETTINGS", "FULL") || can(role as Role, "FINANCE", "FULL");
  const tenantSettings = canManageTenantSettings ? await getOrCreateTenantSettings(tenantId) : null;
  const { t } = await getT();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("account.title")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("account.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("account.profile")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={user.displayName} color={user.avatarColor} size={48} />
            <div>
              <p className="font-medium text-ink">{user.displayName}</p>
              <p className="text-xs text-ink-muted">{user.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-border">
            <div>
              <p className="text-xs text-ink-muted">{t("account.username")}</p>
              <p className="text-sm font-medium text-ink mt-1">{user.username}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">{t("account.roleInWorkspace")}</p>
              <p className="mt-1"><Badge tone="info">{ROLE_LABELS[role as Role]}</Badge></p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">{t("account.accessMode")}</p>
              <p className="mt-1"><Badge status={membership.accessMode}>{membership.accessMode.replace("_", " ")}</Badge></p>
            </div>
            {membership.department && (
              <div>
                <p className="text-xs text-ink-muted">{t("account.department")}</p>
                <p className="text-sm font-medium text-ink mt-1">{membership.department}</p>
              </div>
            )}
            {membership.position && (
              <div>
                <p className="text-xs text-ink-muted">{t("account.position")}</p>
                <p className="text-sm font-medium text-ink mt-1">{membership.position}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-ink-muted">{t("account.workspace")}</p>
              <p className="text-sm font-medium text-ink mt-1">{company?.name ?? "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("account.language")}</CardTitle>
            <CardDescription>{t("account.languageDesc")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <LanguageSwitcher />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("account.security")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("account.notifications")}</CardTitle>
            <CardDescription>{t("account.notificationsDesc")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <NotificationPreferencesForm preferences={preferences} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("account.reminders")}</CardTitle>
            <CardDescription>{t("account.remindersDesc")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ReminderPreferencesForm preferences={reminderPreferences} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("account.theme")}</CardTitle>
            <CardDescription>{t("account.themeDesc")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ThemeSelector currentTheme={user.theme as Theme} />
        </CardContent>
      </Card>

      {tenantSettings && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t("account.companySettings")}</CardTitle>
              <CardDescription>{t("account.companySettingsDesc")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <TenantSettingsForm settings={tenantSettings} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
