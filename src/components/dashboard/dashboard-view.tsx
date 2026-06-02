"use client";

import { BreakdownList } from "@/components/dashboard/breakdown-list";
import { ExecutiveBanner } from "@/components/dashboard/executive-banner";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { ReportingMonthNav } from "@/components/dashboard/reporting-month-nav";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { RevenueExpenseChart } from "@/components/dashboard/revenue-expense-chart";
import { useFinancial } from "@/contexts/financial-context";
import {
  formatMonthLabel,
  formatPeriodLabel,
  getDashboardChartMonths,
  getDashboardInsights,
  getExpenseBreakdown,
  getRevenueBreakdown,
  getMonthlyTotals,
} from "@/lib/calculations";
import { DASHBOARD_CHART_START_MONTH } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";

export function DashboardView() {
  const { records, reportingMonth, personnelMonthlyTotal, hydrated } =
    useFinancial();

  if (!hydrated) {
    return (
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <p className="text-sm text-slate-500">데이터를 불러오는 중…</p>
      </div>
    );
  }

  const insights = getDashboardInsights(
    records,
    reportingMonth,
    personnelMonthlyTotal
  );
  const { metrics } = insights;

  const chartMonths = getDashboardChartMonths(reportingMonth);
  const monthlyTotals = getMonthlyTotals(
    records,
    chartMonths,
    personnelMonthlyTotal
  );
  const monthLabels = Object.fromEntries(
    chartMonths.map((m) => [m, formatMonthLabel(m)])
  );

  const revenueBreakdown = getRevenueBreakdown(records, reportingMonth);
  const expenseBreakdown = getExpenseBreakdown(
    records,
    reportingMonth,
    personnelMonthlyTotal
  );

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
      <header className="sticky top-0 z-30 w-full shrink-0 border-b border-slate-200/80 bg-slate-50/95 pb-4 shadow-sm backdrop-blur-sm">
        <div className="mx-auto w-full min-w-0 max-w-7xl">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:items-start lg:gap-6">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                경영 대시보드
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                {metrics.periodLabel} 손익 요약 · 예비금은 최근 3개월 평균
                운영비×3 · {formatPeriodLabel(DASHBOARD_CHART_START_MONTH)}부터
                추이
              </p>
            </div>
            <ReportingMonthNav className="w-full rounded-xl border border-slate-200/80 bg-white/80 p-3 lg:justify-self-end" />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 pb-4 pt-4">
        <ExecutiveBanner insights={insights} />

        <SummaryCards insights={insights} />

        <KpiStrip insights={insights} />

        <section aria-label="월별 추이" className="w-full min-w-0">
          <RevenueExpenseChart
            data={monthlyTotals}
            monthLabels={monthLabels}
            subtitle={`${formatPeriodLabel(DASHBOARD_CHART_START_MONTH)}부터`}
          />
        </section>

        <section
          aria-label="매출·비용 구성"
          className="grid w-full min-w-0 gap-4 lg:grid-cols-2"
        >
          <BreakdownList
            title="매출 Top"
            periodLabel={metrics.periodLabel}
            totalLabel={formatCurrency(metrics.totalRevenue)}
            items={revenueBreakdown}
            barClassName="bg-teal-500/80"
            emptyMessage="이번 달 매출이 없습니다."
          />
          <BreakdownList
            title="비용 구성"
            periodLabel={metrics.periodLabel}
            totalLabel={formatCurrency(metrics.totalExpenses)}
            items={expenseBreakdown}
            barClassName="bg-rose-500/80"
            emptyMessage="이번 달 비용이 없습니다."
          />
        </section>
      </div>
    </div>
  );
}
