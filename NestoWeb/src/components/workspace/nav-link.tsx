"use client";

import { useLinkStatus } from "next/link";
import { PrefetchLink } from "@/components/ui/prefetch-link";
import { cn } from "@/lib/utils";

/**
 * A sidebar link that warms its destination on hover and admits it is working
 * on click.
 *
 * The hover-warming is PrefetchLink's (components/ui/prefetch-link.tsx); the
 * sidebar is the surface it was built for — around 30 links in the viewport at
 * once, so prefetching on mount would mean 30 concurrent full page renders.
 *
 * What this adds on top is the pending bar, which covers what prefetch cannot:
 * a link clicked without a hover, a slow connection, and development, where
 * Next compiles link prefetching out entirely (client/components/links.js).
 * It puts the acknowledgement inside the row that was clicked — the feedback
 * this app had none of, since a click used to leave the previous page on
 * screen, unchanged, for the whole server render.
 */
function PendingBar() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden rounded-full"
    >
      <span className="block h-full w-1/3 animate-[nav-pending_900ms_ease-in-out_infinite] rounded-full bg-gold/70" />
    </span>
  );
}

export function NavLink({
  href,
  className,
  onClick,
  title,
  children,
}: {
  href: string;
  className?: string;
  onClick?: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <PrefetchLink href={href} onClick={onClick} title={title} className={cn("relative", className)}>
      {children}
      <PendingBar />
    </PrefetchLink>
  );
}
