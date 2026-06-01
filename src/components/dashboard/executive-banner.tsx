"use client";

import { CurrencyDisplay } from "@/components/dashboard/currency-display";
import { MomBadge } from "@/components/dashboard/mom-badge";
import { formatCurrency } from "@/lib/format";
import type { DashboardInsights } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ExecutiveBannerProps {
  insights: DashboardInsights;
}

export function ExecutiveBanner({ insights }: ExecutiveBannerProps) {
  const { metrics, netProfitMom, profitMarginPercent, ytdNetProfit, ytdThroughLabel } =
    insights;
  const positive = metrics.netProfit >= 0;

  return (
    <div
      className={cn(
        "rounded-2xl border px-5 py-5 sm:px-6 sm:py-6",
        positive
          ? "border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white"
          : "border-rose-200/80 bg-gradient-to-br from-rose-50/80 to-white"
      )}
    >
      <p className="text-sm font-medium text-slate-600">{insights.summaryLine}</p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {metrics.periodLabel} 순이익
          </p>
          <CurrencyDisplay
            amount={metrics.netProfit}
            valueClassName={cn(
              "mt-1 text-4xl font-bold tracking-tight sm:text-5xl",
              positive ? "text-emerald-700" : "text-rose-600"
            )}
            symbolClassName={positive ? "text-emerald-600" : "text-rose-500"}
          />
          <div className="mt-2">
            <MomBadge mom={netProfitMom} />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 sm:gap-6">
          {profitMarginPercent != null && metrics.totalRevenue > 0 && (
            <div>
              <p className="text-xs text-slate-500">이익률</p>
              <p className="text-2xl font-semibold tabular-nums text-slate-900">
                {profitMarginPercent.toFixed(1)}%
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500">{ytdThroughLabel} 누적</p>
            <p
              className={cn(
                "text-2xl font-semibold tabular-nums",
                ytdNetProfit >= 0 ? "text-slate-900" : "text-rose-600"
              )}
            >
              {formatCurrency(ytdNetProfit)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
