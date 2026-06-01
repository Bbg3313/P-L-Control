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
}

export interface MonthlyTotals {
  month: string;
  revenue: number;
  expenses: number;
}

export interface DashboardMetrics {
  totalRevenue: number;
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
