"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/dashboard/currency-display";
import { MomBadge } from "@/components/dashboard/mom-badge";
import { formatCurrency } from "@/lib/format";
import type { DashboardInsights } from "@/lib/types";
import {
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  PiggyBank,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryCardsProps {
  insights: DashboardInsights;
}

const cardShell =
  "border-slate-200/80 bg-white shadow-sm ring-0 transition-shadow hover:shadow-md";

export function SummaryCards({ insights }: SummaryCardsProps) {
  const { metrics, revenueMom, expensesMom, netProfitMom } = insights;
  const capacityShortfall = metrics.investmentCapacity < 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card size="sm" className={cardShell}>
        <CardHeader className="pb-1">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-sm font-medium text-slate-700">
                총 매출
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                공급가액 · {metrics.periodLabel}
              </CardDescription>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10">
              <TrendingUp className="h-4 w-4 text-teal-600" strokeWidth={2} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-2">
          <CurrencyDisplay
            amount={metrics.totalRevenue}
            valueClassName="text-2xl font-semibold text-slate-900"
          />
          {metrics.totalRevenueVat > 0 && (
            <p className="text-xs text-slate-500">
              부가세 {formatCurrency(metrics.totalRevenueVat)} · 합계{" "}
              {formatCurrency(metrics.totalRevenueGross)}
            </p>
          )}
          <MomBadge mom={revenueMom} />
        </CardContent>
      </Card>

      <Card size="sm" className={cardShell}>
        <CardHeader className="pb-1">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-sm font-medium text-slate-700">
                총 비용
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                인건비 + 기타
              </CardDescription>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10">
              <TrendingDown className="h-4 w-4 text-rose-500" strokeWidth={2} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-2">
          <CurrencyDisplay
            amount={metrics.totalExpenses}
            valueClassName="text-2xl font-semibold text-slate-900"
          />
          <MomBadge mom={expensesMom} invertColors />
        </CardContent>
      </Card>

      <Card size="sm" className={cardShell}>
        <CardHeader className="pb-1">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-sm font-medium text-slate-700">
                순이익
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                매출 − 비용
              </CardDescription>
            </div>
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                metrics.netProfit >= 0
                  ? "bg-emerald-500/10"
                  : "bg-rose-500/10"
              )}
            >
              <CircleDollarSign
                className={cn(
                  "h-4 w-4",
                  metrics.netProfit >= 0 ? "text-emerald-500" : "text-rose-500"
                )}
                strokeWidth={2}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-2">
          <CurrencyDisplay
            amount={metrics.netProfit}
            valueClassName={cn(
              "text-2xl font-semibold",
              metrics.netProfit >= 0 ? "text-emerald-600" : "text-rose-500"
            )}
          />
          <MomBadge mom={netProfitMom} />
        </CardContent>
      </Card>

      <Card
        size="sm"
        className={cn(
          cardShell,
          capacityShortfall && "border-amber-200/90 bg-amber-50/40"
        )}
      >
        <CardHeader className="pb-1">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle
                className={cn(
                  "text-sm font-medium",
                  capacityShortfall ? "text-amber-900" : "text-slate-700"
                )}
              >
                투자 여력
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                순이익 − 운영비 {metrics.operatingReserveMonths}개월분
              </CardDescription>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
              <PiggyBank className="h-4 w-4 text-violet-600" strokeWidth={2} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {capacityShortfall ? (
            <p className="text-lg font-semibold text-amber-800">예비금 부족</p>
          ) : (
            <CurrencyDisplay
              amount={metrics.investmentCapacity}
              valueClassName="text-2xl font-semibold text-emerald-600"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
