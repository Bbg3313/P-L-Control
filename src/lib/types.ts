export type TransactionType = "revenue" | "expense";

export interface FinancialRecord {
  id: string;
  date: string;
  /** 매출: 매출처 / 비용: 빈 문자열 가능 */
  client: string;
  category: string;
  /** 매출: 상세 카테고리 (화장품·병원·기타·한약) */
  detailCategory?: string;
  /** 비용: 상세 내역 / 매출: 보조 메모(선택) */
  description: string;
  amount: number;
  type: TransactionType;
  /** 계산서 발행(포함)=true, 무자료=false */
  amountIncludesVat?: boolean;
}

export interface MonthlyTotals {
  month: string;
  revenue: number;
  expenses: number;
}

export interface DashboardMetrics {
  /** 손익 집계용 매출 (미포함=입력액, 포함=공급가액) */
  totalRevenue: number;
  /** 부가세 포함 항목에서 산출한 세액 합계 */
  totalRevenueVat: number;
  /** 매출 + 세액 */
  totalRevenueGross: number;
  /** 계산서 발행 매출 건수 */
  totalRevenueVatIncludedCount: number;
  /** 매입세액 (기타 비용·계산서 수취) */
  totalExpenseVat: number;
  totalExpenseVatIncludedCount: number;
  /** 납부세액 max(0, 매출세−매입세) */
  vatPayable: number;
  /** 환급세액 max(0, 매입세−매출세) */
  vatRefund: number;
  /** 정산용 매출세·매입세 (카드·환급 계산과 동일) */
  vatOutputTotal: number;
  vatInputTotal: number;
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
  /** 상세 카테고리별 Top */
  topDetailCategories: BreakdownItem[];
}
