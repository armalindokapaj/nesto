"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * A `next/link` that warms its destination on hover or focus.
 *
 * Every route in this app is dynamic, and Next does not prefetch a dynamic
 * route on its own — so without this, all of a page's server work starts on
 * click. `prefetch={true}` is the form that helps here: it fetches the whole
 * page rather than a shell, and unlike a shell prefetch it needs no
 * loading.tsx boundary (see getFetchStrategyFromPrefetchProp in
 * next/dist/client/app-dir/link.js).
 *
 * It starts at `prefetch={false}` and flips on the first hover or focus,
 * rather than prefetching on mount, because these components render in
 * groups — a row of KPI tiles, a tab bar — and prefetching a whole group at
 * once would fire that many full page renders at the server for the one the
 * user actually wants. Hover-to-click is a few hundred milliseconds, which is
 * most of a page's render time.
 *
 * Deliberately NOT for links inside long lists or tables: a hover-sweep down
 * a hundred-row table would queue a hundred page renders. Use plain `Link`
 * there.
 */
export function PrefetchLink({
  href,
  className,
  title,
  children,
  onClick,
}: {
  href: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const [warm, setWarm] = useState(false);

  return (
    <Link
      href={href}
      className={className}
      title={title}
      onClick={onClick}
      prefetch={warm}
      onMouseEnter={() => setWarm(true)}
      onFocus={() => setWarm(true)}
    >
      {children}
    </Link>
  );
}
