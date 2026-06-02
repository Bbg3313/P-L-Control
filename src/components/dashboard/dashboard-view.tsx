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
      <div className="flex min-h-0 flex-1 items-center justify-center">
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
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
    <div className="mx-auto max-w-7xl space-y-6 pb-4">
      <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            경영 대시보드
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {metrics.periodLabel} 손익 요약 · 예비금은 최근 3개월 평균 운영비×3
            · {formatPeriodLabel(DASHBOARD_CHART_START_MONTH)}부터 추이
          </p>
        </div>
        <ReportingMonthNav className="shrink-0 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3" />
      </header>

      <ExecutiveBanner insights={insights} />

      <SummaryCards insights={insights} />

      <KpiStrip insights={insights} />

      <section aria-label="월별 추이">
        <RevenueExpenseChart
          data={monthlyTotals}
          monthLabels={monthLabels}
          subtitle={`${formatPeriodLabel(DASHBOARD_CHART_START_MONTH)}부터`}
        />
      </section>

      <section
        aria-label="매출·비용 구성"
        className="grid gap-4 lg:grid-cols-2"
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
