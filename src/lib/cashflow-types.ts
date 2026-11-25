/** 모든 금액은 부가세 포함(원) */

export type CollectionStatus = "unpaid" | "paid";

export const COLLECTION_STATUS_LABELS: Record<CollectionStatus, string> = {
  unpaid: "미수",
  paid: "입금완료",
};

/** 계약 상태 — 해지/연장 시 수동 변경 */
export type ContractStatus = "외주" | "자체" | "보류" | "해지";

export const CONTRACT_STATUS_OPTIONS: ContractStatus[] = [
  "외주",
  "자체",
  "보류",
  "해지",
];

export type ExpenseSource =
  | "manual"
  | "payroll-bbg"
  | "payroll-goldfender"
  | "fixed-th"
  | "fixed-vn"
  | "meta-daily";

export const CASHFLOW_SEED_VERSION = 11;

export interface HospitalTemplate {
  id: string;
  name: string;
  /** 월 용역비 (부가세 포함) */
  defaultAmount: number;
  /** 입금 예정일 (1~31, 선택) */
  expectedDay: number | null;
  contractStatus: ContractStatus;
}

export interface ExpenseTemplate {
  id: string;
  name: string;
  defaultAmount: number;
  /** 지출일 (1~31). 말일은 31로 저장. 일별 비용은 null */
  payDay: number | null;
  source: ExpenseSource;
  /** 매일 카드결제 등 일별 단가 (원) */
  dailyAmount?: number;
}

export interface HospitalMonthRow {
  id: string;
  name: string;
  contractStatus: ContractStatus;
  /** 당월 청구액 (부가세 포함, 수동 수정 가능) */
  amount: number;
  /** 입금 예정일 (그달 1~31일) */
  expectedDay: number | null;
  /** 미수 | 입금완료 — 입금되면 청구액 전액 수금으로 집계 */
  status: CollectionStatus;
}

export interface ExpenseMonthRow {
  id: string;
  name: string;
  amount: number;
  note: string;
  payDay: number | null;
  source: ExpenseSource;
  /** 일별 단가 — source=meta-daily 일 때 체크포인트 누적에 사용 */
  dailyAmount?: number;
  /** 기지급 | 미지급 — 체크포인트 ‘더 필요’는 미지급만 반영 */
  status: CollectionStatus;
}

/** 병원 외 기타 수금 (수동 추가) */
export interface MiscCollectionRow {
  id: string;
  name: string;
  amount: number;
  expectedDay: number | null;
  status: CollectionStatus;
}

export interface CashflowMonth {
  yearMonth: string;
  hospitals: HospitalMonthRow[];
  expenses: ExpenseMonthRow[];
  miscCollections: MiscCollectionRow[];
}

export interface CashflowSnapshot {
  hospitals: HospitalTemplate[];
  expenseTemplates: ExpenseTemplate[];
  months: Record<string, CashflowMonth>;
  seedVersion?: number;
  updatedAt: string;
}

export function createEmptyCashflow(): CashflowSnapshot {
  return {
    hospitals: [],
    expenseTemplates: [],
    months: {},
    seedVersion: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function isActiveContract(status: ContractStatus): boolean {
  return status === "외주" || status === "자체";
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}
