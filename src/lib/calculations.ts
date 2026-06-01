import type {
  DashboardMetrics,
  ExpenseBreakdownItem,
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

/** 기록에 등장하는 연월(YYYY-MM), 최신순 */
export function getYearMonthsFromRecords(records: FinancialRecord[]): string[] {
  const months = new Set<string>();
  for (const record of records) {
    if (record.date.length >= 7) months.add(record.date.slice(0, 7));
  }
  return Array.from(months).sort((a, b) => b.localeCompare(a));
}

/**
 * 대시보드 기본 보고 월.
 * 이번 달에 매출·비용 기록이 없으면 가장 최근 데이터가 있는 달을 씁니다.
 */
export function getSuggestedReportingMonth(
  records: FinancialRecord[],
  current = getCurrentYearMonth()
): string {
  const hasCurrentMonthData = records.some(
    (r) => r.date.slice(0, 7) === current
  );
  if (hasCurrentMonthData) return current;

  const fromRecords = getYearMonthsFromRecords(records);
  return fromRecords[0] ?? current;
}

/** 저장된 보고 월이 비어 있으면 데이터가 있는 달로 맞춤 */
export function resolveReportingMonth(
  records: FinancialRecord[],
  saved: string | null,
  current = getCurrentYearMonth()
): string {
  const savedValid =
    saved && /^\d{4}-\d{2}$/.test(saved) ? saved : null;
  const monthsWithRecords = getYearMonthsFromRecords(records);

  if (monthsWithRecords.length === 0) {
    return savedValid ?? current;
  }

  if (
    savedValid &&
    records.some((r) => r.date.slice(0, 7) === savedValid)
  ) {
    return savedValid;
  }

  return getSuggestedReportingMonth(records, current);
}

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return getCurrentYearMonth(d);
}

/** 집계 월 빠른 선택 목록 (선택 월 + 데이터 있는 달) */
export function getReportingMonthOptions(
  records: FinancialRecord[],
  reportingMonth: string
): string[] {
  const months = getYearMonthsFromRecords(records);
  if (!months.includes(reportingMonth)) {
    months.push(reportingMonth);
  }
  return months.sort((a, b) => b.localeCompare(a));
}

export function mergeChartMonths(
  baseMonths: string[],
  ...extra: string[]
): string[] {
  const merged = new Set([...baseMonths, ...extra.filter(Boolean)]);
  return Array.from(merged).sort();
}

export function getLatestYearMonthFromDates(dates: string[]): string | null {
  const months = Array.from(
    new Set(
      dates
        .map((d) => d.slice(0, 7))
        .filter((ym) => /^\d{4}-\d{2}$/.test(ym))
    )
  );
  if (months.length === 0) return null;
  return months.reduce((max, ym) => (ym > max ? ym : max));
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

const PERSONNEL_BREAKDOWN_LABEL = "인건비";

/** 해당 월 비용을 카테고리별로 합산 (고정 인건비 포함) */
export function getExpenseBreakdown(
  records: FinancialRecord[],
  yearMonth: string,
  personnelMonthly = 0
): ExpenseBreakdownItem[] {
  const totals = new Map<string, number>();

  if (personnelMonthly > 0) {
    totals.set(PERSONNEL_BREAKDOWN_LABEL, personnelMonthly);
  }

  for (const record of records) {
    if (record.type !== "expense") continue;
    if (parseYearMonth(record.date) !== yearMonth) continue;

    const label =
      record.category.trim() ||
      record.description.trim() ||
      "기타 비용";
    totals.set(label, (totals.get(label) ?? 0) + record.amount);
  }

  const grandTotal = Array.from(totals.values()).reduce((sum, n) => sum + n, 0);

  return Array.from(totals.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      share: grandTotal > 0 ? amount / grandTotal : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
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

/** 환율 등 소수 입력 */
export function parseDecimalInput(value: string): number {
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function sortRecordsByDateDesc(records: FinancialRecord[]): FinancialRecord[] {
  return [...records].sort((a, b) => b.date.localeCompare(a.date));
}
