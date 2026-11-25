"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ExpenseMonthRow } from "@/lib/cashflow-types";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const COLORS = [
  "#0f766e",
  "#e11d48",
  "#0369a1",
  "#b45309",
  "#4d7c0f",
  "#7c3aed",
  "#be123c",
  "#0e7490",
  "#a16207",
  "#334155",
  "#059669",
  "#c2410c",
  "#1d4ed8",
  "#9f1239",
  "#115e59",
];

interface MixSlice {
  name: string;
  value: number;
  pct: number;
  color: string;
}

interface CashflowExpenseMixProps {
  expenses: ExpenseMonthRow[];
  className?: string;
}

function MixTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: MixSlice }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2 shadow-md">
      <p className="text-xs font-semibold text-slate-700">{row.name}</p>
      <p className="mt-1 text-sm font-medium tabular-nums text-slate-900">
        {formatCurrency(row.value)}
        <span className="ml-1.5 text-xs font-semibold text-slate-500">
          {row.pct}%
        </span>
      </p>
    </div>
  );
}

export function CashflowExpenseMix({
  expenses,
  className,
}: CashflowExpenseMixProps) {
  const active = expenses.filter((row) => !row.excluded);
  const total = active.reduce(
    (sum, row) => sum + Math.max(0, Math.floor(row.amount || 0)),
    0
  );

  const slices: MixSlice[] = active
    .map((row) => {
      const value = Math.max(0, Math.floor(row.amount || 0));
      return {
        name: row.name || "이름 없음",
        value,
        pct: total > 0 ? Math.round((value / total) * 1000) / 10 : 0,
        color: "",
      };
    })
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((row, i) => ({
      ...row,
      color: COLORS[i % COLORS.length],
    }));

  if (slices.length === 0 || total <= 0) {
    return (
      <div
        className={cn(
          "flex h-[160px] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-400",
          className
        )}
      >
        표시할 월 비용이 없습니다
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white px-3 py-2.5",
        className
      )}
    >
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">월 비용 비중</h2>
        <span className="text-[11px] tabular-nums text-slate-500">
          합계 {formatCurrency(total)}
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="relative mx-auto h-[140px] w-[140px] shrink-0 sm:mx-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={38}
                outerRadius={62}
                paddingAngle={1.5}
                stroke="#fff"
                strokeWidth={1}
              >
                {slices.map((slice) => (
                  <Cell key={slice.name} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip content={<MixTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] font-medium text-slate-400">합계</span>
            <span className="text-xs font-semibold tabular-nums text-slate-800">
              {formatCompactCurrency(total)}
            </span>
          </div>
        </div>

        <div className="min-h-0 max-h-[148px] min-w-0 flex-1 overflow-y-auto pr-0.5">
          <ul className="flex flex-col gap-1">
            {slices.map((slice) => (
              <li
                key={slice.name}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-1.5 text-[11px]"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="truncate text-slate-600" title={slice.name}>
                  {slice.name}
                </span>
                <span className="tabular-nums text-slate-500">
                  {slice.pct}%
                </span>
                <span className="min-w-[4.5rem] text-right font-medium tabular-nums text-slate-800">
                  {formatCurrency(slice.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
