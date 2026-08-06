import Link from "next/link";
import { LayoutDashboard, Workflow, Truck, ClipboardList, Layers3, MessagesSquare, PackageOpen, CalendarCheck2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  ["Overview", "/dashboard/procurement", LayoutDashboard],
  ["Workspace", "/dashboard/procurement/workspace", Workflow],
  ["Suppliers", "/dashboard/procurement/suppliers", Truck],
  ["Documents", "/dashboard/procurement/documents", ShieldCheck],
  ["Requests", "/dashboard/procurement/requests", ClipboardList],
  ["Packages", "/dashboard/procurement/packages", Layers3],
  ["Sourcing", "/dashboard/procurement/sourcing", MessagesSquare],
  ["Orders", "/dashboard/procurement/orders", PackageOpen],
  ["Delivery", "/dashboard/procurement/deliveries", CalendarCheck2],
] as const;

export function ProcurementNav({ active }: { active: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface p-1.5">
      <nav aria-label="Procurement sections" className="flex min-w-max gap-1">
        {ITEMS.map(([label, href, Icon]) => (
          <Link key={href} href={href} className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors", active === label.toLowerCase() ? "bg-ink text-white" : "text-ink-muted hover:bg-surface-sunken hover:text-ink")}>
            <Icon size={13} /> {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function ProcurementPageHeader({ eyebrow = "Procurement", title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-gold">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
