"use client";

import { ExpenseBreakdown } from "@/components/dashboard/expense-breakdown";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { RevenueExpenseChart } from "@/components/dashboard/revenue-expense-chart";
import { useFinancial } from "@/contexts/financial-context";
import {
  formatMonthLabel,
  getChartMonths,
  getDashboardMetrics,
  getExpenseBreakdown,
  getMonthlyTotals,
} from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";

export function DashboardView() {
  const { records, reportingMonth, personnelMonthlyTotal, hydrated } =
    useFinancial();

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">데이터를 불러오는 중…</p>
      </div>
    );
  }

  const metrics = getDashboardMetrics(
    records,
    reportingMonth,
    personnelMonthlyTotal
  );
  const chartMonths = getChartMonths(6);
  const monthlyTotals = getMonthlyTotals(
    records,
    chartMonths,
    personnelMonthlyTotal
  );
  const monthLabels = Object.fromEntries(
    chartMonths.map((m) => [m, formatMonthLabel(m)])
  );
  const expenseBreakdown = getExpenseBreakdown(
    records,
    reportingMonth,
    personnelMonthlyTotal
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="space-y-3 border-b border-slate-200/80 pb-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
              Overview
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              대시보드
            </h1>
          </div>
          <p className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
            {metrics.periodLabel}
          </p>
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-500">
          기업 손익 요약 및 투자 여력입니다.{" "}
          <span className="text-slate-600">
            투자 여력 = 순이익 − 고정비 예비금 (
            {formatCurrency(metrics.fixedCostsReserve)})
          </span>
          . 매출·비용 페이지에서 입력한 내역이 실시간 반영됩니다.
        </p>
      </header>

      <section aria-label="핵심 지표" className="space-y-5">
        <SummaryCards metrics={metrics} />
      </section>

      <section aria-label="비용 세부" className="space-y-4">
        <ExpenseBreakdown
          items={expenseBreakdown}
          totalExpenses={metrics.totalExpenses}
          periodLabel={metrics.periodLabel}
        />
      </section>

      <section aria-label="월별 추이" className="space-y-4">
        <RevenueExpenseChart
          data={monthlyTotals}
          monthLabels={monthLabels}
        />
      </section>
    </div>
  );
}
