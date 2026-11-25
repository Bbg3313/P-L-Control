"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { buildExpenseAccountMix } from "@/lib/cashflow-calc";
import type { ExpenseMonthRow } from "@/lib/cashflow-types";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const ACCOUNT_COLORS: Record<string, string> = {
  payroll: "#0f766e",
  ads: "#e11d48",
  sales: "#0369a1",
  office: "#b45309",
  finance: "#7c3aed",
  ops: "#4d7c0f",
  other: "#64748b",
};

interface MixSlice {
  key: string;
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
  const slices: MixSlice[] = useMemo(() => {
    return buildExpenseAccountMix(expenses).map((row) => ({
      ...row,
      color: ACCOUNT_COLORS[row.key] ?? ACCOUNT_COLORS.other,
    }));
  }, [expenses]);

  const total = slices.reduce((sum, row) => sum + row.value, 0);

  if (slices.length === 0 || total <= 0) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[160px] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-400",
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
        "flex h-full flex-col rounded-lg border border-slate-200 bg-white px-2.5 py-2",
        className
      )}
    >
      <div className="mb-1 flex items-baseline justify-between gap-1">
        <h2 className="text-sm font-semibold text-slate-800">월 비용 비중</h2>
        <span className="text-[10px] tabular-nums text-slate-500">
          {formatCompactCurrency(total)}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-stretch gap-1.5">
        <div className="relative mx-auto h-[100px] w-[100px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={28}
                outerRadius={44}
                paddingAngle={1.5}
                stroke="#fff"
                strokeWidth={1}
              >
                {slices.map((slice) => (
                  <Cell key={slice.key} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip content={<MixTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
          <ul className="flex flex-col gap-0.5">
            {slices.map((slice) => (
              <li
                key={slice.key}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-1 text-[10px]"
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="truncate text-slate-600" title={slice.name}>
                  {slice.name}
                </span>
                <span className="tabular-nums text-slate-500">{slice.pct}%</span>
                <span className="min-w-[3.5rem] text-right tabular-nums text-slate-700">
                  {formatCompactCurrency(slice.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
