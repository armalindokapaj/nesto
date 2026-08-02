"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_CATEGORICAL } from "./palette";
import { formatNumber, formatCurrency } from "@/lib/utils";

export type DonutDatum = { label: string; value: number };

// `format` is a serializable string, not a function — Server Components
// (every dashboard page) pass props to this Client Component, and functions
// can't cross that boundary. Add new formats here rather than a callback prop.
export function DonutChart({
  data,
  centerLabel,
  centerValue,
  format: formatKind = "number",
}: {
  data: DonutDatum[];
  centerLabel?: string;
  centerValue?: string;
  format?: "number" | "currency";
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const format = formatKind === "currency" ? formatCurrency : (v: number) => formatNumber(v);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative h-[168px] w-[168px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={54}
              outerRadius={78}
              paddingAngle={2}
              stroke="var(--color-surface)"
              strokeWidth={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_CATEGORICAL[i % CHART_CATEGORICAL.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [format(Number(value)), String(name)]}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                fontSize: 12,
                boxShadow: "0 4px 12px rgba(26,29,35,0.08)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {centerValue && <span className="text-lg font-semibold text-ink">{centerValue}</span>}
            {centerLabel && <span className="text-[0.65rem] text-ink-muted">{centerLabel}</span>}
          </div>
        )}
      </div>
      <ul className="flex-1 w-full space-y-2">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-ink-muted truncate">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: CHART_CATEGORICAL[i % CHART_CATEGORICAL.length] }}
                aria-hidden
              />
              {d.label}
            </span>
            <span className="font-medium text-ink tabular-nums shrink-0">
              {format(d.value)}
              <span className="text-ink-faint font-normal ml-1.5">
                {total > 0 ? `${Math.round((d.value / total) * 100)}%` : "0%"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
