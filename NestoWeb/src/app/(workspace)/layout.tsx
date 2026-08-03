import { getCurrentUser } from "@/lib/dal";
import { unreadNotificationCount } from "@/server/notifications";
import { countWorkInbox } from "@/server/work-inbox";
import { getDisabledModules } from "@/server/company-modules";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@/lib/constants";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { user, role, company, tenantId } = await getCurrentUser();
  const [notificationCount, inboxCount, disabledModules] = await Promise.all([
    unreadNotificationCount(tenantId, user.id),
    countWorkInbox(tenantId, user.id, role as Role),
    getDisabledModules(tenantId),
  ]);

  return (
    <WorkspaceShell
      companyName={company?.name ?? "Nesto"}
      workspaceLabel={ROLE_LABELS[role as Role]}
      userName={user.displayName}
      role={role as Role}
      avatarColor={user.avatarColor}
      notificationCount={notificationCount}
      inboxCount={inboxCount}
      isPlatformAdmin={user.isPlatformAdmin}
      disabledModules={[...disabledModules]}
    >
      {children}
    </WorkspaceShell>
  );
}
