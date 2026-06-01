"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { ExpenseBreakdownItem } from "@/lib/types";

interface ExpenseBreakdownProps {
  items: ExpenseBreakdownItem[];
  totalExpenses: number;
  periodLabel: string;
}

export function ExpenseBreakdown({
  items,
  totalExpenses,
  periodLabel,
}: ExpenseBreakdownProps) {
  return (
    <Card className="border-slate-200/80 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-slate-900">
          비용 세부내역
        </CardTitle>
        <CardDescription className="text-slate-500">
          {periodLabel} · 카테고리별 합계 ({formatCurrency(totalExpenses)})
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            해당 기간 비용 내역이 없습니다.
          </p>
        ) : (
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item.category}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-800">
                    {item.category}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-700">
                    {formatCurrency(item.amount)}
                    <span className="ml-1.5 text-xs font-normal text-slate-400">
                      {(item.share * 100).toFixed(1)}%
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-rose-500/80 transition-all"
                    style={{ width: `${Math.max(item.share * 100, 1)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
