import type {
  BreakdownItem,
  DashboardInsights,
  DashboardMetrics,
  ExpenseBreakdownItem,
  FinancialRecord,
  MonthOverMonth,
  MonthlyTotals,
  NextMonthRevenueForecast,
  TransactionType,
} from "./types";
import {
  DASHBOARD_CHART_START_MONTH,
  OPERATING_RESERVE_LOOKBACK_MONTHS,
  OPERATING_RESERVE_MONTHS,
} from "./constants";
import { getRevenueSupplyAmount, splitRevenueAmount, summarizeRevenueVat } from "./vat";

export {
  OPERATING_RESERVE_LOOKBACK_MONTHS,
  OPERATING_RESERVE_MONTHS,
};

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
    .reduce(
      (sum, r) =>
        sum +
        (type === "revenue" ? getRevenueSupplyAmount(r) : r.amount),
      0
    );
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

/** 해당 월 운영비 = 기타 비용 + 고정 인건비 */
export function getMonthlyOperatingBurn(
  records: FinancialRecord[],
  yearMonth: string,
  personnelMonthly = 0
): number {
  return sumByMonth(records, yearMonth, "expense") + personnelMonthly;
}

/**
 * 최근 N개월 평균 운영비 (데이터 있는 달만 평균, 없으면 인건비만 하한).
 * 예비금 = 이 값 × OPERATING_RESERVE_MONTHS (통상 3개월분).
 */
export function getAverageMonthlyOperatingBurn(
  records: FinancialRecord[],
  throughMonth: string,
  personnelMonthly = 0,
  lookbackMonths = OPERATING_RESERVE_LOOKBACK_MONTHS
): number {
  const chartMonths = getDashboardChartMonths(throughMonth);
  const recent = chartMonths.slice(-lookbackMonths);
  if (recent.length === 0) {
    return personnelMonthly > 0 ? personnelMonthly : 0;
  }

  const burns = recent.map((m) =>
    getMonthlyOperatingBurn(records, m, personnelMonthly)
  );
  const sum = burns.reduce((a, b) => a + b, 0);
  const avg = sum / burns.length;

  if (avg > 0) return avg;
  return personnelMonthly > 0 ? personnelMonthly : 0;
}

export function getOperatingReserve(
  records: FinancialRecord[],
  throughMonth: string,
  personnelMonthly = 0,
  reserveMonths = OPERATING_RESERVE_MONTHS
): number {
  const avgBurn = getAverageMonthlyOperatingBurn(
    records,
    throughMonth,
    personnelMonthly
  );
  return Math.round(avgBurn * reserveMonths);
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
function calcMonthOverMonth(
  current: number,
  previous: number
): MonthOverMonth {
  if (previous === 0) {
    return {
      previous,
      changePercent: current === 0 ? 0 : null,
    };
  }
  return {
    previous,
    changePercent: ((current - previous) / previous) * 100,
  };
}

/** 5월부터 선택 월까지 연속 구간 (차트용) */
export function getDashboardChartMonths(
  reportingMonth: string,
  startMonth = DASHBOARD_CHART_START_MONTH
): string[] {
  const start = reportingMonth < startMonth ? reportingMonth : startMonth;
  const end = reportingMonth >= startMonth ? reportingMonth : startMonth;

  const months: string[] = [];
  let [y, m] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);

  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  return months;
}

/** 해당 연도 1월~선택 월 누적 */
export function getYearToDateTotals(
  records: FinancialRecord[],
  throughMonth: string,
  personnelMonthly = 0
): { revenue: number; expenses: number; netProfit: number } {
  const year = throughMonth.slice(0, 4);
  const months = getDashboardChartMonths(throughMonth).filter(
    (m) => m.startsWith(year) && m <= throughMonth
  );

  let revenue = 0;
  let expenses = 0;
  for (const month of months) {
    revenue += sumByMonth(records, month, "revenue");
    expenses +=
      sumByMonth(records, month, "expense") +
      (personnelMonthly > 0 ? personnelMonthly : 0);
  }

  return { revenue, expenses, netProfit: revenue - expenses };
}

/** 매출처별 합계 (상위 N건) */
export function getRevenueBreakdown(
  records: FinancialRecord[],
  yearMonth: string,
  limit = 5
): BreakdownItem[] {
  const totals = new Map<string, number>();

  for (const record of records) {
    if (record.type !== "revenue") continue;
    if (parseYearMonth(record.date) !== yearMonth) continue;

    const label =
      record.client.trim() ||
      record.category.trim() ||
      "미지정 매출처";
    const supply = splitRevenueAmount(
      record.amount,
      record.amountIncludesVat ?? false
    ).supply;
    totals.set(label, (totals.get(label) ?? 0) + supply);
  }

  const sorted = Array.from(totals.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const top = sorted.slice(0, limit);
  const other = sorted.slice(limit).reduce((sum, r) => sum + r.amount, 0);
  const items =
    other > 0
      ? [...top, { category: "기타", amount: other }]
      : top;

  const grandTotal = items.reduce((sum, i) => sum + i.amount, 0);

  return items.map(({ category, amount }) => ({
    category,
    amount,
    share: grandTotal > 0 ? amount / grandTotal : 0,
  }));
}

/**
 * 다음 달 예상 매출 — 집계 월(예: 5월) 실적을 그대로 전월 전망.
 * 비용은 기준 월 수준으로 가정해 예상 순이익도 함께 산출.
 */
export function getNextMonthRevenueForecast(
  records: FinancialRecord[],
  baseMonth: string,
  personnelMonthly = 0
): NextMonthRevenueForecast {
  const targetMonth = shiftYearMonth(baseMonth, 1);
  const baseRevenue = sumByMonth(records, baseMonth, "revenue");
  const baseExpenses = getMonthlyOperatingBurn(
    records,
    baseMonth,
    personnelMonthly
  );
  const actualRevenueInTarget = sumByMonth(records, targetMonth, "revenue");

  return {
    baseMonth,
    baseMonthLabel: formatPeriodLabel(baseMonth),
    targetMonth,
    targetMonthLabel: formatPeriodLabel(targetMonth),
    baseRevenue,
    forecastRevenue: baseRevenue,
    actualRevenueInTarget,
    projectedNetProfit: baseRevenue - baseExpenses,
    baseExpenses,
    topClients: getRevenueBreakdown(records, baseMonth, 5),
  };
}

function buildSummaryLine(
  metrics: DashboardMetrics,
  netProfitMom: MonthOverMonth | null,
  profitMarginPercent: number | null,
  ytdNetProfit: number,
  ytdThroughLabel: string
): string {
  const parts: string[] = [];

  if (metrics.netProfit >= 0) {
    parts.push(`${metrics.periodLabel} 흑자`);
  } else {
    parts.push(`${metrics.periodLabel} 적자`);
  }

  if (netProfitMom?.changePercent != null) {
    const sign = netProfitMom.changePercent >= 0 ? "+" : "";
    parts.push(`순이익 전월 대 ${sign}${netProfitMom.changePercent.toFixed(1)}%`);
  } else if (netProfitMom && netProfitMom.previous === 0 && metrics.netProfit !== 0) {
    parts.push("순이익 전월 데이터 없음");
  }

  if (profitMarginPercent != null && metrics.totalRevenue > 0) {
    parts.push(`이익률 ${profitMarginPercent.toFixed(1)}%`);
  }

  if (metrics.investmentCapacity < 0) {
    parts.push("투자 여력 부족");
  }

  if (ytdNetProfit !== 0 || metrics.totalRevenue > 0) {
    parts.push(`${ytdThroughLabel} 누적 순이익 ${ytdNetProfit >= 0 ? "흑자" : "적자"}`);
  }

  return parts.join(" · ");
}

export function getDashboardInsights(
  records: FinancialRecord[],
  yearMonth: string,
  personnelMonthly = 0
): DashboardInsights {
  const metrics = getDashboardMetrics(records, yearMonth, personnelMonthly);
  const previousMonth = shiftYearMonth(yearMonth, -1);
  const hasPrevious = previousMonth >= DASHBOARD_CHART_START_MONTH;

  const prevRevenue = hasPrevious
    ? sumByMonth(records, previousMonth, "revenue")
    : 0;
  const prevExpenses = hasPrevious
    ? sumByMonth(records, previousMonth, "expense") + personnelMonthly
    : 0;
  const prevNetProfit = prevRevenue - prevExpenses;

  const revenueMom = hasPrevious
    ? calcMonthOverMonth(metrics.totalRevenue, prevRevenue)
    : null;
  const expensesMom = hasPrevious
    ? calcMonthOverMonth(metrics.totalExpenses, prevExpenses)
    : null;
  const netProfitMom = hasPrevious
    ? calcMonthOverMonth(metrics.netProfit, prevNetProfit)
    : null;

  const profitMarginPercent =
    metrics.totalRevenue > 0
      ? (metrics.netProfit / metrics.totalRevenue) * 100
      : null;

  const personnelRatioPercent =
    metrics.totalRevenue > 0
      ? (personnelMonthly / metrics.totalRevenue) * 100
      : null;

  const ytd = getYearToDateTotals(records, yearMonth, personnelMonthly);
  const year = yearMonth.slice(0, 4);
  const ytdThroughLabel = `${year}년 ${Number(yearMonth.slice(5, 7))}월까지`;

  const summaryLine = buildSummaryLine(
    metrics,
    netProfitMom,
    profitMarginPercent,
    ytd.netProfit,
    ytdThroughLabel
  );

  return {
    metrics,
    personnelMonthly,
    previousMonth: hasPrevious ? previousMonth : null,
    previousMonthLabel: hasPrevious ? formatPeriodLabel(previousMonth) : null,
    revenueMom,
    expensesMom,
    netProfitMom,
    profitMarginPercent,
    personnelRatioPercent,
    ytdRevenue: ytd.revenue,
    ytdExpenses: ytd.expenses,
    ytdNetProfit: ytd.netProfit,
    ytdThroughLabel,
    summaryLine,
  };
}

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
  const revenueVat = summarizeRevenueVat(records, yearMonth);
  const totalRevenue = revenueVat.supplyTotal;
  const totalExpenses = getMonthlyOperatingBurn(
    records,
    yearMonth,
    personnelMonthly
  );
  const netProfit = totalRevenue - totalExpenses;
  const averageMonthlyOperatingBurn = getAverageMonthlyOperatingBurn(
    records,
    yearMonth,
    personnelMonthly
  );
  const fixedCostsReserve = getOperatingReserve(
    records,
    yearMonth,
    personnelMonthly
  );
  const investmentCapacity = netProfit - fixedCostsReserve;

  return {
    totalRevenue,
    totalRevenueVat: revenueVat.vatTotal,
    totalRevenueGross: revenueVat.grossTotal,
    totalRevenueVatIncludedCount: revenueVat.vatIncludedCount,
    totalExpenses,
    netProfit,
    investmentCapacity,
    fixedCostsReserve,
    averageMonthlyOperatingBurn,
    operatingReserveMonths: OPERATING_RESERVE_MONTHS,
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
