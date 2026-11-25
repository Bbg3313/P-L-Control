"use client";

import { useMemo } from "react";
import { buildExpenseTimingBuckets } from "@/lib/cashflow-calc";
import type { ExpenseMonthRow } from "@/lib/cashflow-types";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const TONE: Record<
  string,
  { bar: string; chip: string; text: string }
> = {
  start: {
    bar: "bg-sky-500",
    chip: "bg-sky-50 text-sky-800",
    text: "text-sky-700",
  },
  day10: {
    bar: "bg-amber-500",
    chip: "bg-amber-50 text-amber-900",
    text: "text-amber-800",
  },
  monthEnd: {
    bar: "bg-rose-500",
    chip: "bg-rose-50 text-rose-800",
    text: "text-rose-700",
  },
};

interface CashflowExpenseTimingProps {
  expenses: ExpenseMonthRow[];
  yearMonth?: string;
  className?: string;
}

export function CashflowExpenseTiming({
  expenses,
  yearMonth,
  className,
}: CashflowExpenseTimingProps) {
  const buckets = useMemo(
    () => buildExpenseTimingBuckets(expenses, yearMonth),
    [expenses, yearMonth]
  );
  const total = buckets.reduce((s, b) => s + b.amount, 0);

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-lg border border-slate-200 bg-white px-3 py-2.5",
        className
      )}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">지출 시점</h2>
        <span className="text-[10px] text-slate-400">25일~ → 말</span>
      </div>

      {total <= 0 ? (
        <p className="flex flex-1 items-center justify-center text-xs text-slate-400">
          표시할 비용 없음
        </p>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-2">
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
            {buckets.map((b) =>
              b.amount > 0 ? (
                <div
                  key={b.key}
                  className={cn("h-full", TONE[b.key]?.bar)}
                  style={{ width: `${Math.max(b.pct, 0)}%` }}
                  title={`${b.label} ${b.pct}%`}
                />
              ) : null
            )}
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {buckets.map((b) => {
              const tone = TONE[b.key];
              return (
                <div
                  key={b.key}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-center",
                    tone?.chip
                  )}
                >
                  <div className="text-[10px] font-semibold opacity-80">
                    {b.label}
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 text-base font-bold tabular-nums tracking-tight",
                      tone?.text
                    )}
                  >
                    {b.pct}%
                  </div>
                  <div className="mt-0.5 text-[10px] font-medium tabular-nums text-slate-600">
                    {formatCurrency(b.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
