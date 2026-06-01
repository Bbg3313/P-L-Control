import { SummaryCards } from "@/components/dashboard/summary-cards";
import { RevenueExpenseChart } from "@/components/dashboard/revenue-expense-chart";
import {
  formatMonthLabel,
  getChartMonths,
  getDashboardMetrics,
  getMonthlyTotals,
} from "@/lib/financial-data";
import { formatCurrency } from "@/lib/format";

export default function DashboardPage() {
  const metrics = getDashboardMetrics("2026-06");
  const chartMonths = getChartMonths(6);
  const monthlyTotals = getMonthlyTotals(chartMonths);

  const monthLabels = Object.fromEntries(
    chartMonths.map((m) => [m, formatMonthLabel(m)])
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {metrics.periodLabel}
          </span>
          기준 기업 손익 요약 및 투자 여력입니다. 투자 여력 = 순이익 − 고정비
          예비금 ({formatCurrency(metrics.fixedCostsReserve)}).
        </p>
      </header>

      <SummaryCards metrics={metrics} />

      <RevenueExpenseChart data={monthlyTotals} monthLabels={monthLabels} />
    </div>
  );
}
