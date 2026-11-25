"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyCashflowPoint } from "@/lib/cashflow-calc";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const CHART = {
  received: "#0d9488",
  expenses: "#e11d48",
  net: "#1e293b",
  grid: "#e2e8f0",
  axis: "#94a3b8",
  font: "var(--font-pretendard), Pretendard, system-ui, sans-serif",
};

interface CashflowDailyChartProps {
  data: DailyCashflowPoint[];
  className?: string;
}

interface TooltipPayloadItem {
  dataKey?: string | number;
  name?: string;
  value?: number;
  color?: string;
  payload?: DailyCashflowPoint;
}

function DailyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const short = point.net < 0;
  const rows = [
    { key: "paid", label: "입금", value: point.paidReceived },
    { key: "unpaid", label: "예정", value: point.unpaidReceived },
    { key: "received", label: "수금 합", value: point.received, color: CHART.received },
    { key: "expenses", label: "비용", value: point.expenses, color: CHART.expenses },
    {
      key: "net",
      label: short ? "더 필요" : "남음",
      value: Math.abs(point.net),
      color: short ? "#dc2626" : "#047857",
    },
  ];

  return (
    <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 shadow-md">
      <p className="mb-2 text-xs font-semibold text-slate-700">{label}일 누적</p>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex items-center justify-between gap-6 text-sm"
          >
            <span className="flex items-center gap-2 text-slate-600">
              {row.color ? (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
              ) : (
                <span className="h-2 w-2" />
              )}
              {row.label}
            </span>
            <span className="font-medium tabular-nums text-slate-900">
              {formatCurrency(row.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CashflowDailyChart({
  data,
  className,
}: CashflowDailyChartProps) {
  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex h-[220px] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-400",
          className
        )}
      >
        표시할 일별 데이터가 없습니다
      </div>
    );
  }

  const last = data[data.length - 1];
  const maxAbs = Math.max(
    1,
    ...data.flatMap((d) => [d.received, d.expenses, Math.abs(d.net)])
  );
  const yDomain: [number, number] = [-maxAbs * 0.08, maxAbs * 1.12];
  const short = last.net < 0;

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white px-2 pb-2 pt-2 sm:px-3",
        className
      )}
    >
      <div className="mb-1 flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">일별 수금·비용</h2>
          <p className="text-[11px] text-slate-500">
            1일~말일 누적 · 호버 시 입금·예정·비용·잔액
          </p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
          <span>
            말일 수금{" "}
            <span className="tabular-nums text-slate-700">
              {formatCurrency(last.received)}
            </span>
          </span>
          <span>
            말일 비용{" "}
            <span className="tabular-nums text-slate-700">
              {formatCurrency(last.expenses)}
            </span>
          </span>
          <span className={short ? "text-red-600" : "text-emerald-700"}>
            {short ? "더 필요" : "남음"}{" "}
            <span className="font-semibold tabular-nums">
              {formatCurrency(Math.abs(last.net))}
            </span>
          </span>
        </div>
      </div>

      <div className="h-[220px] w-full min-w-0 sm:h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="4 4"
              stroke={CHART.grid}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: CHART.axis, fontFamily: CHART.font }}
              tickLine={false}
              axisLine={{ stroke: CHART.grid }}
              interval="preserveStartEnd"
              minTickGap={8}
              dy={4}
            />
            <YAxis
              width={48}
              tick={{ fontSize: 10, fill: CHART.axis, fontFamily: CHART.font }}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              domain={yDomain}
              tickFormatter={(v) => formatCompactCurrency(Number(v))}
            />
            <ReferenceLine y={0} stroke={CHART.grid} />
            <Tooltip
              content={<DailyTooltip />}
              cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
            />
            <Legend
              wrapperStyle={{ paddingTop: 4, fontSize: 12 }}
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span className="text-xs text-slate-600">{value}</span>
              )}
            />
            <Area
              type="monotone"
              dataKey="received"
              name="예정수금"
              stroke={CHART.received}
              fill={CHART.received}
              fillOpacity={0.12}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              name="비용"
              stroke={CHART.expenses}
              fill={CHART.expenses}
              fillOpacity={0.08}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="net"
              name="잔액"
              stroke={CHART.net}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
