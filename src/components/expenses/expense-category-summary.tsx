"use client";

import { formatCurrency } from "@/lib/format";
import {
  OFFICE_MANAGEMENT_GROUP,
  OFFICE_MANAGEMENT_SOURCE_LABELS,
} from "@/lib/expense-category-groups";
import type { ExpenseBreakdownItem } from "@/lib/types";

interface ExpenseCategorySummaryProps {
  periodLabel: string;
  items: ExpenseBreakdownItem[];
}

export function ExpenseCategorySummary({
  periodLabel,
  items,
}: ExpenseCategorySummaryProps) {
  if (items.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-rose-200/70 bg-rose-50/50 px-4 py-3">
      <p className="text-sm font-semibold text-rose-900">
        {periodLabel} 기타 비용 집계
      </p>
      <p className="mt-0.5 text-xs text-rose-700/80">
        {OFFICE_MANAGEMENT_SOURCE_LABELS.join(", ")} → {OFFICE_MANAGEMENT_GROUP}
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.category}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span
                className={
                  item.category === OFFICE_MANAGEMENT_GROUP
                    ? "font-semibold text-rose-900"
                    : "font-medium text-slate-800"
                }
              >
                {item.category}
              </span>
              <span className="shrink-0 tabular-nums text-slate-700">
                {formatCurrency(item.amount)}
                <span className="ml-1 text-xs text-slate-400">
                  {(item.share * 100).toFixed(0)}%
                </span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/80">
              <div
                className={
                  item.category === OFFICE_MANAGEMENT_GROUP
                    ? "h-full rounded-full bg-rose-500/80"
                    : "h-full rounded-full bg-slate-400/60"
                }
                style={{ width: `${Math.max(item.share * 100, 2)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
