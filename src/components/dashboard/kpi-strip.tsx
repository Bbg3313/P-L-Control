"use client";

import { formatCurrency } from "@/lib/format";
import type { DashboardInsights } from "@/lib/types";

interface KpiStripProps {
  insights: DashboardInsights;
}

export function KpiStrip({ insights }: KpiStripProps) {
  const {
    metrics,
    personnelRatioPercent,
    ytdRevenue,
    ytdThroughLabel,
  } = insights;
  const investmentCapacity = metrics.investmentCapacity;

  const items = [
    {
      label: "매출",
      value: formatCurrency(metrics.totalRevenue),
      sub: insights.revenueMom
        ? `전월 ${formatCurrency(insights.revenueMom.previous)}`
        : undefined,
    },
    {
      label: "총 비용",
      value: formatCurrency(metrics.totalExpenses),
      sub: insights.personnelMonthly > 0
        ? `인건비 ${formatCurrency(insights.personnelMonthly)}`
        : undefined,
    },
    {
      label: "인건비 비율",
      value:
        personnelRatioPercent != null && metrics.totalRevenue > 0
          ? `${personnelRatioPercent.toFixed(1)}%`
          : "—",
      sub: "매출 대비",
    },
    {
      label: "투자 여력",
      value:
        investmentCapacity >= 0
          ? formatCurrency(investmentCapacity)
          : "부족",
      sub: `예비금 ${formatCurrency(metrics.fixedCostsReserve)} (운영비 ${metrics.operatingReserveMonths}개월분)`,
      warn: investmentCapacity < 0,
    },
    {
      label: "월평균 운영비",
      value: formatCurrency(metrics.averageMonthlyOperatingBurn),
      sub: `최근 ${metrics.operatingReserveMonths}개월 평균 · 인건비+기타`,
    },
    {
      label: `${ytdThroughLabel} 매출`,
      value: formatCurrency(ytdRevenue),
      sub: "연 누적",
    },
  ];

  return (
    <div className="grid w-full min-w-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="min-w-0 w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm"
        >
          <p className="text-xs font-medium text-slate-500">{item.label}</p>
          <p
            className={`mt-1 text-lg font-semibold tabular-nums ${
              item.warn ? "text-amber-700" : "text-slate-900"
            }`}
          >
            {item.value}
          </p>
          {item.sub && (
            <p className="mt-0.5 text-[11px] text-slate-400">{item.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}
