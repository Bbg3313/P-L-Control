import type {
  DashboardMetrics,
  FinancialRecord,
  MonthlyTotals,
  TransactionType,
} from "./types";
import { FIXED_COSTS_RESERVE } from "./constants";

export { FIXED_COSTS_RESERVE };

function parseYearMonth(date: string): string {
  return date.slice(0, 7);
}

function sumByMonth(
  records: FinancialRecord[],
  yearMonth: string,
  type: TransactionType
): number {
  return records
    .filter((r) => r.type === type && parseYearMonth(r.date) === yearMonth)
    .reduce((sum, r) => sum + r.amount, 0);
}

export function getCurrentYearMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatPeriodLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    "ko-KR",
    { month: "long", year: "numeric" }
  );
}

export function getMonthlyTotals(
  records: FinancialRecord[],
  months: string[],
  personnelMonthly = 0
): MonthlyTotals[] {
  return months.map((month) => ({
    month,
    revenue: sumByMonth(records, month, "revenue"),
    expenses:
      sumByMonth(records, month, "expense") +
      (personnelMonthly > 0 ? personnelMonthly : 0),
  }));
}

export function getDashboardMetrics(
  records: FinancialRecord[],
  yearMonth: string,
  personnelMonthly = 0
): DashboardMetrics {
  const totalRevenue = sumByMonth(records, yearMonth, "revenue");
  const totalExpenses =
    sumByMonth(records, yearMonth, "expense") + personnelMonthly;
  const netProfit = totalRevenue - totalExpenses;
  const investmentCapacity = netProfit - FIXED_COSTS_RESERVE;

  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    investmentCapacity,
    fixedCostsReserve: FIXED_COSTS_RESERVE,
    periodLabel: formatPeriodLabel(yearMonth),
  };
}

export function getChartMonths(count = 6, end = new Date()): string[] {
  const months: string[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push(ym);
  }

  return months;
}

export function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    "ko-KR",
    { month: "short" }
  );
}

export function formatRecordDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function parseAmountInput(value: string): number {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

export function sortRecordsByDateDesc(records: FinancialRecord[]): FinancialRecord[] {
  return [...records].sort((a, b) => b.date.localeCompare(a.date));
}
