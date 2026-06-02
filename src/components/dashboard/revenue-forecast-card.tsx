"use client";

import { ArrowRight, TrendingUp } from "lucide-react";
import { CurrencyDisplay } from "@/components/dashboard/currency-display";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { NextMonthRevenueForecast } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RevenueForecastCardProps {
  forecast: NextMonthRevenueForecast;
}

export function RevenueForecastCard({ forecast }: RevenueForecastCardProps) {
  const {
    baseMonthLabel,
    targetMonthLabel,
    baseRevenue,
    forecastRevenue,
    actualRevenueInTarget,
    projectedNetProfit,
    baseExpenses,
    topClients,
  } = forecast;

  const hasBase = baseRevenue > 0;
  const hasActual = actualRevenueInTarget > 0;
  const positive = projectedNetProfit >= 0;

  return (
    <Card className="overflow-hidden border-sky-200/80 bg-gradient-to-br from-sky-50/90 via-white to-white shadow-sm ring-0">
      <CardHeader className="border-b border-sky-100/80 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <TrendingUp className="h-4 w-4 text-sky-600" strokeWidth={2} />
              {targetMonthLabel} 예상 매출
            </CardTitle>
            <CardDescription className="text-sm text-slate-600">
              {baseMonthLabel} 실적 기준 · 동일 매출 전망
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-sky-200/60">
            <span>{baseMonthLabel}</span>
            <ArrowRight className="h-3.5 w-3.5 text-sky-500" aria-hidden />
            <span className="text-sky-700">{targetMonthLabel}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        {!hasBase ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {baseMonthLabel} 매출이 없어 예상 매출을 산출할 수 없습니다.
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-sky-700/80">
                  예상 매출
                </p>
                <CurrencyDisplay
                  amount={forecastRevenue}
                  valueClassName="mt-1 text-3xl font-bold text-slate-900 sm:text-4xl"
                  symbolClassName="text-sky-600"
                />
                <p className="mt-2 text-sm text-slate-500">
                  {baseMonthLabel} 실적{" "}
                  <span className="font-medium tabular-nums text-slate-700">
                    {formatCurrency(baseRevenue)}
                  </span>
                  과 동일
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 sm:min-w-[11rem]">
                <p className="text-xs text-slate-500">예상 순이익</p>
                <p className="text-xs text-slate-400">
                  {baseMonthLabel} 비용 수준 가정
                </p>
                <p
                  className={cn(
                    "mt-1 text-xl font-bold tabular-nums",
                    positive ? "text-emerald-600" : "text-rose-600"
                  )}
                >
                  {formatCurrency(projectedNetProfit)}
                </p>
                <p className="mt-1 text-[11px] tabular-nums text-slate-400">
                  비용 {formatCurrency(baseExpenses)}
                </p>
              </div>
            </div>

            {hasActual && (
              <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-sm">
                <span className="font-medium text-amber-900">
                  {targetMonthLabel} 등록 매출
                </span>
                <span className="ml-2 font-semibold tabular-nums text-amber-950">
                  {formatCurrency(actualRevenueInTarget)}
                </span>
                <span className="ml-2 text-amber-800/80">
                  (전망 대{" "}
                  {actualRevenueInTarget >= forecastRevenue ? "+" : ""}
                  {formatCurrency(actualRevenueInTarget - forecastRevenue)})
                </span>
              </div>
            )}

            {topClients.length > 0 && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {baseMonthLabel} 매출처 기준 Top
                </p>
                <ul className="space-y-2.5">
                  {topClients.map((item) => (
                    <li key={item.category}>
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate font-medium text-slate-800">
                          {item.category}
                        </span>
                        <span className="shrink-0 tabular-nums text-slate-600">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-sky-100">
                        <div
                          className="h-full rounded-full bg-sky-500/80"
                          style={{
                            width: `${Math.max(item.share * 100, 2)}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
