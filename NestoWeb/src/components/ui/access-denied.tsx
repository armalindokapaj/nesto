import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// PRD_10 §9.3/AC-06 — a deep link to a record the viewer can't see must
// return a neutral state: no title, category, assignee, or other metadata
// that would itself leak what the record is.
export function AccessDenied({ backHref, backLabel, message }: { backHref: string; backLabel: string; message: string }) {
  return (
    <div className="space-y-6">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> {backLabel}
      </Link>
      <Card>
        <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
          <Lock size={22} className="text-ink-faint" />
          <p className="text-sm text-ink-faint max-w-sm">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}
