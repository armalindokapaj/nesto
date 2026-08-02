"use client";

import { LineChart as RLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_CATEGORICAL, CHART_INK } from "./palette";
import { formatCurrency, formatNumber } from "@/lib/utils";

export type SeriesConfig = { key: string; label: string };

// `format` is a serializable string, not a function — see donut-chart.tsx
// for why a callback prop can't be passed from a Server Component here.
export function TrendLineChart({
  data,
  series,
  format: formatKind = "number",
}: {
  data: Record<string, number | string>[];
  series: SeriesConfig[];
  format?: "number" | "currency";
}) {
  const format = formatKind === "currency" ? formatCurrency : (v: number) => formatNumber(v);

  return (
    <div className="w-full">
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RLineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_INK.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: CHART_INK.muted }}
              axisLine={{ stroke: CHART_INK.axis }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: CHART_INK.muted }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => format(Number(v))}
              width={56}
            />
            <Tooltip
              formatter={(value, name) => [format(Number(value)), String(name)]}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                fontSize: 12,
                boxShadow: "0 4px 12px rgba(26,29,35,0.08)",
              }}
            />
            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={CHART_CATEGORICAL[i % CHART_CATEGORICAL.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </RLineChart>
        </ResponsiveContainer>
      </div>
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
          {series.map((s, i) => (
            <li key={s.key} className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: CHART_CATEGORICAL[i % CHART_CATEGORICAL.length] }}
                aria-hidden
              />
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
