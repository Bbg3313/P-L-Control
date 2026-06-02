export type TransactionType = "revenue" | "expense";

export interface FinancialRecord {
  id: string;
  date: string;
  /** 매출: 매출처 / 비용: 빈 문자열 가능 */
  client: string;
  category: string;
  /** 비용: 상세 내역 / 매출: 보조 메모(선택) */
  description: string;
  amount: number;
  type: TransactionType;
  /** 매출만 — 입력 금액이 부가세 포함(합계)인지 */
  amountIncludesVat?: boolean;
}

export interface MonthlyTotals {
  month: string;
  revenue: number;
  expenses: number;
}

export interface DashboardMetrics {
  /** 매출 공급가액 (부가세 제외) */
  totalRevenue: number;
  totalRevenueVat: number;
  totalRevenueGross: number;
  totalExpenses: number;
  netProfit: number;
  investmentCapacity: number;
  /** 운영 예비금 (평균 월 운영비 × N개월) */
  fixedCostsReserve: number;
  /** 예비금 산정에 쓴 월평균 운영비 */
  averageMonthlyOperatingBurn: number;
  operatingReserveMonths: number;
  periodLabel: string;
}

export interface BreakdownItem {
  category: string;
  amount: number;
  /** 0~1 */
  share: number;
}

export type ExpenseBreakdownItem = BreakdownItem;

export interface MonthOverMonth {
  previous: number;
  changePercent: number | null;
}

export interface DashboardInsights {
  metrics: DashboardMetrics;
  personnelMonthly: number;
  previousMonth: string | null;
  previousMonthLabel: string | null;
  revenueMom: MonthOverMonth | null;
  expensesMom: MonthOverMonth | null;
  netProfitMom: MonthOverMonth | null;
  profitMarginPercent: number | null;
  personnelRatioPercent: number | null;
  ytdRevenue: number;
  ytdExpenses: number;
  ytdNetProfit: number;
  ytdThroughLabel: string;
  summaryLine: string;
}

/** 집계 월 실적을 바탕으로 한 다음 달 매출 전망 */
export interface NextMonthRevenueForecast {
  baseMonth: string;
  baseMonthLabel: string;
  targetMonth: string;
  targetMonthLabel: string;
  /** 기준 월(예: 5월) 실적 매출 */
  baseRevenue: number;
  /** 다음 달 예상 매출 — 기준 월과 동일 전망 */
  forecastRevenue: number;
  /** 다음 달에 이미 등록된 매출 */
  actualRevenueInTarget: number;
  /** 기준 월 비용 수준 가정 시 예상 순이익 */
  projectedNetProfit: number;
  baseExpenses: number;
  topClients: BreakdownItem[];
}
