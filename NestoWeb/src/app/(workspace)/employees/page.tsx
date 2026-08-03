import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { listEmployeeDirectory } from "@/server/employee-profile";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getT } from "@/lib/i18n/server";

// Company-wide directory — every active internal member can discover every
// colleague's profile shell, same "open by default, sensitive data still
// gated" principle PRD_10 already applies to projects.
export default async function EmployeeDirectoryPage() {
  const { tenantId } = await getCurrentUser();
  const employees = await listEmployeeDirectory(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("hr_sub.directoryTitle")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("hr_sub.directorySubtitle")}</p>
      </div>

      {employees.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-sm text-ink-faint">{t("hr_sub.noEmployees")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((e) => (
            <Link key={e.id} href={`/employees/${e.id}`}>
              <Card className="h-full hover:border-border-strong transition-colors">
                <CardContent className="flex items-center gap-3">
                  <Avatar name={e.fullName} color={e.avatarColor} src={e.photoDataUrl} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-ink truncate">{e.fullName}</p>
                      {e.status !== "ACTIVE" && <Badge status={e.status}>{e.status.replace("_", " ")}</Badge>}
                    </div>
                    <p className="text-xs text-ink-muted truncate">{e.position} · {e.department}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
