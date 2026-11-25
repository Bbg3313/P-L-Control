import {
  buildPayrollLedger,
  type PayrollCompanyId,
} from "@/lib/payroll-ledger";
import {
  createDefaultPersonnel,
  isRepresentativeDirector,
  isUnpaidPayrollPersonnel,
} from "@/lib/personnel";
import { applyPersonnelReferenceSalary } from "@/lib/personnel-reference-salaries";
import type { ExpenseSource, ExpenseTemplate } from "@/lib/cashflow-types";

/** 고정 ID — 월별 행과 템플릿을 맞춤 */
export const EXPENSE_IDS = {
  payrollBbg: "exp-payroll-bbg",
  payrollCeo: "exp-payroll-ceo",
  payrollGoldfender: "exp-payroll-goldfender",
  thailand: "exp-thailand-corp",
  vietnam: "exp-vietnam-corp",
  meta: "exp-meta-ads",
  commission: "exp-sales-commission",
  otherCommission: "exp-other-sales-commission",
  interpretation: "exp-interpretation",
  rent: "exp-rent",
  maintenance: "exp-maintenance",
  telecom: "exp-telecom",
  loan: "exp-loan-repay",
  socialInsurance: "exp-social-insurance",
  aiSub: "exp-ai-subscription",
  companyCar: "exp-company-car",
  copier: "exp-copier",
} as const;

export const FIXED_THAILAND_PAYROLL = 5_000_000;
export const FIXED_VIETNAM_PAYROLL = 1_750_000;
export const META_DAILY_AMOUNT = 700_000;
export const FIXED_RENT = 1_210_000;
export const FIXED_MAINTENANCE = 500_000;
export const FIXED_TELECOM = 500_000;
export const FIXED_LOAN_REPAY = 5_000_000;
export const FIXED_SOCIAL_INSURANCE = 4_000_000;
export const FIXED_AI_SUBSCRIPTION = 1_000_000;
export const FIXED_COMPANY_CAR = 2_100_000;
export const FIXED_COPIER = 200_000;

export function daysInYearMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

/** 지급월 → 급여 귀속월 (11월 10일 지급 = 10월 급여) */
export function payrollSourceYearMonth(cashflowYearMonth: string): string {
  if (!/^\d{4}-\d{2}$/.test(cashflowYearMonth)) return cashflowYearMonth;
  const [y, m] = cashflowYearMonth.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** BBG 인건비에서 제외: 미지급 (김영창·서미희·이정석) */
function sumNetPay(
  yearMonth: string,
  companyId: PayrollCompanyId,
  performancePayOverrides: Record<string, number>,
  excludeUnpaid: boolean
): number {
  const personnel = createDefaultPersonnel().map((e) =>
    applyPersonnelReferenceSalary(e.name, e)
  );
  const ledger = buildPayrollLedger(
    yearMonth,
    personnel,
    {},
    companyId,
    performancePayOverrides
  );
  return ledger.domestic.reduce((sum, row) => {
    if (excludeUnpaid && isUnpaidPayrollPersonnel(row.name)) return sum;
    return sum + Math.max(0, Math.floor(row.netPay || 0));
  }, 0);
}

export function calcBbgNetPayTotal(
  yearMonth: string,
  performancePayOverrides: Record<string, number> = {}
): number {
  return sumNetPay(yearMonth, "bluebridge", performancePayOverrides, true);
}

/** 대표이사(이정석) 실지급액 — BBG 인건비와 별도 라인 */
export function calcCeoNetPayTotal(
  yearMonth: string,
  performancePayOverrides: Record<string, number> = {}
): number {
  const personnel = createDefaultPersonnel().map((e) =>
    applyPersonnelReferenceSalary(e.name, e)
  );
  const ledger = buildPayrollLedger(
    yearMonth,
    personnel,
    {},
    "bluebridge",
    performancePayOverrides
  );
  const row = ledger.domestic.find((r) => isRepresentativeDirector(r.name));
  return row ? Math.max(0, Math.floor(row.netPay || 0)) : 0;
}

export function calcGoldfenderNetPayTotal(
  yearMonth: string,
  performancePayOverrides: Record<string, number> = {}
): number {
  return sumNetPay(yearMonth, "goldfender", performancePayOverrides, false);
}

export function calcMetaMonthlyAmount(yearMonth: string): number {
  return META_DAILY_AMOUNT * daysInYearMonth(yearMonth);
}

export const SEED_EXPENSE_TEMPLATES: ExpenseTemplate[] = [
  {
    id: EXPENSE_IDS.payrollBbg,
    name: "인건비 (BBG)",
    defaultAmount: 0,
    payDay: 10,
    source: "payroll-bbg",
  },
  {
    id: EXPENSE_IDS.payrollCeo,
    name: "인건비 (대표이사)",
    defaultAmount: 0,
    payDay: 10,
    source: "payroll-ceo",
  },
  {
    id: EXPENSE_IDS.payrollGoldfender,
    name: "인건비 (골드펜더)",
    defaultAmount: 0,
    payDay: 31,
    source: "payroll-goldfender",
  },
  {
    id: EXPENSE_IDS.thailand,
    name: "태국법인 인건비",
    defaultAmount: FIXED_THAILAND_PAYROLL,
    payDay: 31,
    source: "fixed-th",
  },
  {
    id: EXPENSE_IDS.vietnam,
    name: "베트남법인 인건비",
    defaultAmount: FIXED_VIETNAM_PAYROLL,
    payDay: 31,
    source: "fixed-vn",
  },
  {
    id: EXPENSE_IDS.meta,
    name: "Meta 광고비",
    defaultAmount: 0,
    payDay: null,
    source: "meta-daily",
    dailyAmount: META_DAILY_AMOUNT,
  },
  {
    id: EXPENSE_IDS.commission,
    name: "영업커미션",
    defaultAmount: 0,
    payDay: 31,
    source: "manual",
  },
  {
    id: EXPENSE_IDS.otherCommission,
    name: "기타영업커미션",
    defaultAmount: 0,
    payDay: 31,
    source: "manual",
  },
  {
    id: EXPENSE_IDS.interpretation,
    name: "통역비",
    defaultAmount: 0,
    payDay: 31,
    source: "manual",
  },
  {
    id: EXPENSE_IDS.rent,
    name: "임대료",
    defaultAmount: FIXED_RENT,
    payDay: 1,
    source: "manual",
  },
  {
    id: EXPENSE_IDS.maintenance,
    name: "관리비",
    defaultAmount: FIXED_MAINTENANCE,
    payDay: 1,
    source: "manual",
  },
  {
    id: EXPENSE_IDS.telecom,
    name: "통신비",
    defaultAmount: FIXED_TELECOM,
    payDay: 25,
    source: "manual",
  },
  {
    id: EXPENSE_IDS.loan,
    name: "대출상환",
    defaultAmount: FIXED_LOAN_REPAY,
    payDay: 10,
    source: "manual",
  },
  {
    id: EXPENSE_IDS.socialInsurance,
    name: "4대보험",
    defaultAmount: FIXED_SOCIAL_INSURANCE,
    payDay: 10,
    source: "manual",
  },
  {
    id: EXPENSE_IDS.aiSub,
    name: "AI구독",
    defaultAmount: FIXED_AI_SUBSCRIPTION,
    payDay: 25,
    source: "manual",
  },
  {
    id: EXPENSE_IDS.companyCar,
    name: "법인차량",
    defaultAmount: FIXED_COMPANY_CAR,
    payDay: 20,
    source: "manual",
  },
  {
    id: EXPENSE_IDS.copier,
    name: "복합기",
    defaultAmount: FIXED_COPIER,
    payDay: 25,
    source: "manual",
  },
];

/**
 * @param cashflowYearMonth 비용이 나가는 달 (예: 2026-11)
 * @param performancePayOverrides 전월(급여 귀속월) 성과급 오버라이드
 */
export function resolveLinkedExpenseAmount(
  source: ExpenseSource,
  cashflowYearMonth: string,
  performancePayOverrides: Record<string, number> = {}
): number | null {
  if (source === "payroll-bbg") {
    return calcBbgNetPayTotal(
      payrollSourceYearMonth(cashflowYearMonth),
      performancePayOverrides
    );
  }
  if (source === "payroll-ceo") {
    return calcCeoNetPayTotal(
      payrollSourceYearMonth(cashflowYearMonth),
      performancePayOverrides
    );
  }
  if (source === "payroll-goldfender") {
    return calcGoldfenderNetPayTotal(
      payrollSourceYearMonth(cashflowYearMonth),
      performancePayOverrides
    );
  }
  if (source === "fixed-th") return FIXED_THAILAND_PAYROLL;
  if (source === "fixed-vn") return FIXED_VIETNAM_PAYROLL;
  if (source === "meta-daily") return calcMetaMonthlyAmount(cashflowYearMonth);
  return null;
}

/** @deprecated use resolveLinkedExpenseAmount */
export const resolvePayrollLinkedAmount = resolveLinkedExpenseAmount;
