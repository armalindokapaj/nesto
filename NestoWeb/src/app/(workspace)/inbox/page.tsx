import Link from "next/link";
import { ClipboardCheck, CheckSquare, Search, AlertCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { getWorkInbox } from "@/server/work-inbox";
import { Card, CardContent } from "@/components/ui/card";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/utils";

const CATEGORY_ICON = {
  APPROVAL: ClipboardCheck,
  TASK_ACTION: CheckSquare,
  REVIEW: Search,
  DATA_CORRECTION: AlertCircle,
} as const;

export default async function WorkInboxPage() {
  const { tenantId, user, role } = await getCurrentUser();
  const items = await getWorkInbox(tenantId, user.id, role);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("inbox.title")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("inbox.subtitle")}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="text-sm text-ink-faint py-16 text-center">{t("inbox.empty")}</p>
          ) : (
            <ul>
              {items.map((item) => {
                const Icon = CATEGORY_ICON[item.category];
                return (
                  <li key={item.id} className="border-b border-border last:border-0">
                    <Link href={item.href} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-sunken transition-colors">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-soft shrink-0">
                        <Icon size={16} className="text-gold-strong" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink truncate">{item.title}</p>
                        {item.subtitle && <p className="text-xs text-ink-muted truncate">{item.subtitle}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-medium text-gold">{t(`inbox.category_${item.category}`)}</p>
                        {item.dueDate && <p className="text-xs text-ink-faint mt-0.5">{formatDate(item.dueDate)}</p>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
