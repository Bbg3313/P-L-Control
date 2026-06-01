"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { BreakdownItem } from "@/lib/types";

interface BreakdownListProps {
  title: string;
  periodLabel: string;
  totalLabel: string;
  items: BreakdownItem[];
  barClassName: string;
  emptyMessage: string;
}

export function BreakdownList({
  title,
  periodLabel,
  totalLabel,
  items,
  barClassName,
  emptyMessage,
}: BreakdownListProps) {
  return (
    <Card className="border-slate-200/80 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-slate-900">
          {title}
        </CardTitle>
        <CardDescription className="text-slate-500">
          {periodLabel} · {totalLabel}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.category}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium text-slate-800">
                    {item.category}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-700">
                    {formatCurrency(item.amount)}
                    <span className="ml-1 text-xs text-slate-400">
                      {(item.share * 100).toFixed(0)}%
                    </span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${barClassName}`}
                    style={{ width: `${Math.max(item.share * 100, 2)}%` }}
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
