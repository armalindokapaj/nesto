import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { unreadNotificationCount } from "@/server/notifications";
import { countWorkInbox } from "@/server/work-inbox";
import { getDisabledModules } from "@/server/company-modules";
import { getDisabledRoutes } from "@/server/platform-config";
import { listProjects } from "@/server/projects";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@/lib/constants";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { user, role, company, tenantId } = await getCurrentUser();
  const canUpload = can(role as Role, "DOCUMENTS", "WRITE");
  const [notificationCount, inboxCount, disabledModules, disabledRoutes, uploadProjects] = await Promise.all([
    unreadNotificationCount(tenantId, user.id),
    countWorkInbox(tenantId, user.id, role as Role),
    getDisabledModules(tenantId),
    // Platform Configuration — strips nav entries for pages switched off for
    // this tenant/company, so a disabled module leaves no dead link.
    getDisabledRoutes(tenantId, company?.id),
    // PRD_Documents_Module — Universal Upload: only fetched when the topbar
    // trigger is actually going to render, so pages that never touch
    // Documents don't pay for a project list on every request.
    canUpload ? listProjects(tenantId) : Promise.resolve([]),
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
      disabledRoutes={disabledRoutes}
      canUpload={canUpload}
      uploadProjects={uploadProjects.map((p) => ({ id: p.id, name: p.name }))}
    >
      {children}
    </WorkspaceShell>
  );
}
