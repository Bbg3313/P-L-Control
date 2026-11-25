import type {
  CashflowMonth,
  ContractStatus,
  ExpenseMonthRow,
  ExpenseSource,
  HospitalMonthRow,
  MiscCollectionRow,
} from "@/lib/cashflow-types";
import { isActiveContract } from "@/lib/cashflow-types";

export interface CashflowSummary {
  billedTotal: number;
  receivedTotal: number;
  unpaidTotal: number;
  expenseTotal: number;
  /** 아직 안 나간 비용 합 */
  unpaidExpenseTotal: number;
  miscBilledTotal: number;
  miscReceivedTotal: number;
  paidCount: number;
  unpaidCount: number;
  hospitalCount: number;
  holdCount: number;
  terminatedCount: number;
  expensePaidCount: number;
  expenseUnpaidCount: number;
}

export interface CheckpointSummary {
  key: "start" | "day10" | "monthEnd";
  label: string;
  /** 입금완료 수금(병원+기타) */
  paidReceived: number;
  /** 아직 안 들어온 예정(병원 미수+기타 예상) */
  unpaidReceived: number;
  /** 입금+예정 */
  received: number;
  /** 기준일까지 나갈 비용 총액(전부 지출 예정) */
  expenses: number;
  /** 예정수금 − 비용 */
  net: number;
}

/** 활성(외주·자체) 계약만. 보류·해지 제외 */
export function sumExpectedByDayLimit(
  hospitals: HospitalMonthRow[],
  maxDay: number,
  unpaidOnly = false
): number {
  let total = 0;
  for (const row of hospitals) {
    if (!isActiveContract(row.contractStatus)) continue;
    if (unpaidOnly && row.status === "paid") continue;
    const day = row.expectedDay ?? 31;
    if (day <= maxDay) {
      total += Math.max(0, Math.floor(row.amount || 0));
    }
  }
  return total;
}

/** 기타 수금 예정일 합. unpaidOnly면 예상만, paidOnly면 입금만 */
export function sumMiscExpectedByDayLimit(
  rows: MiscCollectionRow[],
  maxDay: number,
  opts: { unpaidOnly?: boolean; paidOnly?: boolean } = {}
): number {
  let total = 0;
  for (const row of rows) {
    if (opts.unpaidOnly && row.status === "paid") continue;
    if (opts.paidOnly && row.status !== "paid") continue;
    const day = row.expectedDay ?? 31;
    if (day <= maxDay) {
      total += Math.max(0, Math.floor(row.amount || 0));
    }
  }
  return total;
}

/** 입금완료이고 예정일이 maxDay 이하인 청구액 합 */
export function sumReceivedByDayLimit(
  hospitals: HospitalMonthRow[],
  maxDay: number
): number {
  let total = 0;
  for (const row of hospitals) {
    if (!isActiveContract(row.contractStatus)) continue;
    if (row.status !== "paid") continue;
    const day = row.expectedDay ?? 31;
    if (day <= maxDay) {
      total += Math.max(0, Math.floor(row.amount || 0));
    }
  }
  return total;
}

export function summarizeMonth(month: CashflowMonth | null): CashflowSummary {
  const hospitals = month?.hospitals ?? [];
  const expenses = month?.expenses ?? [];
  const misc = month?.miscCollections ?? [];

  let hospitalBilledTotal = 0;
  let hospitalReceivedTotal = 0;
  let paidCount = 0;
  let unpaidCount = 0;
  let activeCount = 0;
  let holdCount = 0;
  let terminatedCount = 0;

  for (const row of hospitals) {
    if (row.contractStatus === "보류") {
      holdCount += 1;
      continue;
    }
    if (row.contractStatus === "해지") {
      terminatedCount += 1;
      continue;
    }
    activeCount += 1;
    const billed = Math.max(0, Math.floor(row.amount || 0));
    hospitalBilledTotal += billed;
    if (row.status === "paid") {
      hospitalReceivedTotal += billed;
      paidCount += 1;
    } else {
      unpaidCount += 1;
    }
  }

  // 기타 수금: 청구·수금·기준일에는 반영. 미수(병원 미수금)에만 제외
  let miscBilledTotal = 0;
  let miscReceivedTotal = 0;
  for (const row of misc) {
    const billed = Math.max(0, Math.floor(row.amount || 0));
    miscBilledTotal += billed;
    if (row.status === "paid") {
      miscReceivedTotal += billed;
    }
  }

  const billedTotal = hospitalBilledTotal + miscBilledTotal;
  const receivedTotal = hospitalReceivedTotal + miscReceivedTotal;
  const unpaidTotal = Math.max(
    0,
    hospitalBilledTotal - hospitalReceivedTotal
  );

  let expenseTotal = 0;
  let unpaidExpenseTotal = 0;
  let expensePaidCount = 0;
  let expenseUnpaidCount = 0;
  for (const row of expenses) {
    if (row.excluded) continue;
    const amount = Math.max(0, Math.floor(row.amount || 0));
    const paid = Math.min(
      amount,
      Math.max(0, Math.floor(row.paidAmount || 0))
    );
    const remaining = Math.max(0, amount - paid);
    expenseTotal += amount;
    unpaidExpenseTotal += remaining;
    if (remaining <= 0 && amount > 0) expensePaidCount += 1;
    else expenseUnpaidCount += 1;
  }

  return {
    billedTotal,
    receivedTotal,
    unpaidTotal,
    expenseTotal,
    unpaidExpenseTotal,
    miscBilledTotal,
    miscReceivedTotal,
    paidCount,
    unpaidCount,
    hospitalCount: activeCount,
    holdCount,
    terminatedCount,
    expensePaidCount,
    expenseUnpaidCount,
  };
}

function daysInCashflowMonth(yearMonth: string | undefined): number {
  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) return 30;
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** 월 비용 비중용 계정 묶음 */
export type ExpenseAccountKey =
  | "payroll"
  | "ads"
  | "sales"
  | "office"
  | "finance"
  | "ops"
  | "other";

export const EXPENSE_ACCOUNT_ORDER: ExpenseAccountKey[] = [
  "payroll",
  "ads",
  "sales",
  "office",
  "finance",
  "ops",
  "other",
];

export const EXPENSE_ACCOUNT_LABELS: Record<ExpenseAccountKey, string> = {
  payroll: "인건비",
  ads: "광고비",
  sales: "영업·커미션",
  office: "임차·관리",
  finance: "금융",
  ops: "운영·구독",
  other: "기타",
};

export function classifyExpenseAccount(
  row: Pick<ExpenseMonthRow, "name" | "source">
): ExpenseAccountKey {
  const source = row.source;
  if (
    source === "payroll-bbg" ||
    source === "payroll-ceo" ||
    source === "payroll-goldfender" ||
    source === "fixed-th" ||
    source === "fixed-vn"
  ) {
    return "payroll";
  }
  if (source === "meta-daily") return "ads";

  const name = (row.name || "").replace(/\s+/g, "");
  if (
    name.includes("인건비") ||
    name.includes("급여") ||
    name.includes("4대보험")
  ) {
    return "payroll";
  }
  if (name.includes("광고") || name.toLowerCase().includes("meta")) {
    return "ads";
  }
  if (
    name.includes("커미션") ||
    name.includes("통역") ||
    name.includes("영업")
  ) {
    return "sales";
  }
  if (
    name.includes("임대") ||
    name.includes("관리비") ||
    name.includes("청소") ||
    name.includes("통신")
  ) {
    return "office";
  }
  if (name.includes("대출") || name.includes("이자") || name.includes("금융")) {
    return "finance";
  }
  if (
    name.includes("AI") ||
    name.includes("구독") ||
    name.includes("차량") ||
    name.includes("복합기") ||
    name.includes("소프트웨어")
  ) {
    return "ops";
  }
  return "other";
}

export interface ExpenseAccountSlice {
  key: ExpenseAccountKey;
  name: string;
  value: number;
  pct: number;
}

/** 제외 비용 빼고 계정별로 합산 */
export function buildExpenseAccountMix(
  expenses: ExpenseMonthRow[]
): ExpenseAccountSlice[] {
  const sums = new Map<ExpenseAccountKey, number>();
  for (const key of EXPENSE_ACCOUNT_ORDER) sums.set(key, 0);

  for (const row of expenses) {
    if (row.excluded) continue;
    const amount = Math.max(0, Math.floor(row.amount || 0));
    if (amount <= 0) continue;
    const key = classifyExpenseAccount(row);
    sums.set(key, (sums.get(key) ?? 0) + amount);
  }

  const total = [...sums.values()].reduce((a, b) => a + b, 0);
  return EXPENSE_ACCOUNT_ORDER.map((key) => {
    const value = sums.get(key) ?? 0;
    return {
      key,
      name: EXPENSE_ACCOUNT_LABELS[key],
      value,
      pct: total > 0 ? Math.round((value / total) * 1000) / 10 : 0,
    };
  }).filter((s) => s.value > 0);
}

export type ExpenseTimingKey = "start" | "day10" | "monthEnd";

export interface ExpenseTimingBucket {
  key: ExpenseTimingKey;
  label: string;
  amount: number;
  pct: number;
}

/** 지출일 → 초(<10) / 10(10~24) / 말(25~). null은 말 */
export function classifyExpensePayBucket(
  payDay: number | null
): ExpenseTimingKey {
  if (payDay == null) return "monthEnd";
  if (payDay < 10) return "start";
  if (payDay < 25) return "day10";
  return "monthEnd";
}

/**
 * 월 비용이 초·10·말에 각각 얼마·몇 % 나가는지.
 * Meta 일별은 1일 / 2~10일 / 11일~말로 나눔.
 */
export function buildExpenseTimingBuckets(
  expenses: ExpenseMonthRow[],
  yearMonth?: string
): ExpenseTimingBucket[] {
  const daysInMonth = daysInCashflowMonth(yearMonth);
  let start = 0;
  let day10 = 0;
  let monthEnd = 0;

  for (const row of expenses) {
    if (row.excluded) continue;
    const amount = Math.max(0, Math.floor(row.amount || 0));

    if (row.source === "meta-daily" || (row.dailyAmount && row.dailyAmount > 0)) {
      const daily = Math.max(
        0,
        Math.floor(row.dailyAmount || 0) ||
          Math.floor(amount / daysInMonth)
      );
      if (daily <= 0) continue;
      const startDays = Math.min(1, daysInMonth);
      const through10 = Math.min(10, daysInMonth);
      const day10Days = Math.max(0, through10 - startDays);
      const endDays = Math.max(0, daysInMonth - through10);
      start += daily * startDays;
      day10 += daily * day10Days;
      monthEnd += daily * endDays;
      continue;
    }

    if (amount <= 0) continue;
    const bucket = classifyExpensePayBucket(row.payDay);
    if (bucket === "start") start += amount;
    else if (bucket === "day10") day10 += amount;
    else monthEnd += amount;
  }

  const total = start + day10 + monthEnd;
  const pack = (
    key: ExpenseTimingKey,
    label: string,
    value: number
  ): ExpenseTimingBucket => ({
    key,
    label,
    amount: value,
    pct: total > 0 ? Math.round((value / total) * 1000) / 10 : 0,
  });

  return [
    pack("start", "초", start),
    pack("day10", "10일", day10),
    pack("monthEnd", "말", monthEnd),
  ];
}

export function expenseRemaining(row: ExpenseMonthRow): number {
  const amount = Math.max(0, Math.floor(row.amount || 0));
  const paid = Math.min(
    amount,
    Math.max(0, Math.floor(row.paidAmount || 0))
  );
  return Math.max(0, amount - paid);
}

/**
 * 해당 기준일까지 비용.
 * maxDay null = 말일(전체). 일별 비용은 일수×단가.
 * unpaidOnly: 미지급 잔액만 (‘더 필요’ 계산용, 일부지급 반영)
 */
export function sumExpensesByPayDayLimit(
  expenses: ExpenseMonthRow[],
  maxDay: number | null,
  yearMonth?: string,
  unpaidOnly = false
): number {
  const daysInMonth = daysInCashflowMonth(yearMonth);
  let total = 0;
  for (const row of expenses) {
    if (row.excluded) continue;
    const amount = Math.max(0, Math.floor(row.amount || 0));

    // Meta 등 일별: 1일=70만, 10일=700만, 말일=70만×일수
    if (row.source === "meta-daily" || (row.dailyAmount && row.dailyAmount > 0)) {
      const daily = Math.max(
        0,
        Math.floor(row.dailyAmount || 0) ||
          Math.floor(amount / daysInMonth)
      );
      if (daily <= 0) continue;
      const days =
        maxDay == null ? daysInMonth : Math.min(maxDay, daysInMonth);
      let due = daily * days;
      if (unpaidOnly) {
        const paid = Math.min(
          amount || due,
          Math.max(0, Math.floor(row.paidAmount || 0))
        );
        due = Math.max(0, due - Math.min(paid, due));
      }
      total += due;
      continue;
    }

    const remaining = unpaidOnly ? expenseRemaining(row) : amount;
    if (remaining <= 0) continue;
    if (maxDay == null) {
      total += remaining;
      continue;
    }
    // payDay 31(말)은 해당 월 말일로 본다
    const payDay = Math.min(row.payDay ?? 31, daysInMonth);
    if (payDay <= maxDay) total += remaining;
  }
  return total;
}

/** 기준일까지 실제 지급액(수금에서 빠진 돈). 지급 누르면 여기가 바뀜 */
export function sumPaidExpenseByPayDayLimit(
  expenses: ExpenseMonthRow[],
  maxDay: number | null,
  yearMonth?: string
): number {
  const daysInMonth = daysInCashflowMonth(yearMonth);
  let total = 0;
  for (const row of expenses) {
    if (row.excluded) continue;
    const amount = Math.max(0, Math.floor(row.amount || 0));
    const paid = Math.min(
      amount || Number.MAX_SAFE_INTEGER,
      Math.max(0, Math.floor(row.paidAmount || 0))
    );
    if (paid <= 0) continue;

    if (row.source === "meta-daily" || (row.dailyAmount && row.dailyAmount > 0)) {
      const daily = Math.max(
        0,
        Math.floor(row.dailyAmount || 0) ||
          Math.floor(amount / daysInMonth)
      );
      if (daily <= 0) continue;
      const days =
        maxDay == null ? daysInMonth : Math.min(maxDay, daysInMonth);
      total += Math.min(paid, daily * days);
      continue;
    }

    if (maxDay == null) {
      total += paid;
      continue;
    }
    const payDay = Math.min(row.payDay ?? 31, daysInMonth);
    if (payDay <= maxDay) total += paid;
  }
  return total;
}

export interface DailyCashflowPoint {
  day: number;
  /** X축 라벨 (1, 2, …) */
  label: string;
  paidReceived: number;
  unpaidReceived: number;
  /** 입금+예정 누적 */
  received: number;
  /** 해당일까지 나갈 비용 누적 */
  expenses: number;
  /** 예정수금 − 비용 */
  net: number;
}

function packDayCashflow(
  hospitals: HospitalMonthRow[],
  expenses: ExpenseMonthRow[],
  misc: MiscCollectionRow[],
  ym: string | undefined,
  /** 수금 기준일. null = 말일(전체) */
  day: number | null
): Omit<DailyCashflowPoint, "day" | "label"> {
  const receiveDay = day ?? 31;
  const paidReceived =
    sumReceivedByDayLimit(hospitals, receiveDay) +
    sumMiscExpectedByDayLimit(misc, receiveDay, { paidOnly: true });
  const unpaidReceived =
    sumExpectedByDayLimit(hospitals, receiveDay, true) +
    sumMiscExpectedByDayLimit(misc, receiveDay, { unpaidOnly: true });
  const received = paidReceived + unpaidReceived;
  // 비용: null이면 월 비용 전부(말일 지급 포함)
  const total = sumExpensesByPayDayLimit(expenses, day, ym, false);
  return {
    paidReceived,
    unpaidReceived,
    received,
    expenses: total,
    net: received - total,
  };
}

/**
 * 1일~말일 누적 수금·비용·잔액 시리즈.
 * 월 비용은 지급 구분 없이 전부 지출로 본다.
 */
export function buildDailyCashflowSeries(
  month: CashflowMonth | null
): DailyCashflowPoint[] {
  const hospitals = month?.hospitals ?? [];
  const expenses = month?.expenses ?? [];
  const misc = month?.miscCollections ?? [];
  const ym = month?.yearMonth;
  const days = daysInCashflowMonth(ym);
  const points: DailyCashflowPoint[] = [];
  for (let day = 1; day <= days; day++) {
    points.push({
      day,
      label: String(day),
      ...packDayCashflow(hospitals, expenses, misc, ym, day),
    });
  }
  return points;
}

/**
 * 기준일 현금: 예정수금(입금+예정) − 비용(해당일까지 나갈 금액 전부).
 */
export function buildCheckpoints(
  month: CashflowMonth | null
): CheckpointSummary[] {
  const hospitals = month?.hospitals ?? [];
  const expenses = month?.expenses ?? [];
  const misc = month?.miscCollections ?? [];
  const ym = month?.yearMonth;

  function pack(
    maxDay: number | null,
    label: string,
    key: CheckpointSummary["key"]
  ): CheckpointSummary {
    return {
      key,
      label,
      ...packDayCashflow(hospitals, expenses, misc, ym, maxDay),
    };
  }

  return [
    pack(1, "1일 기준", "start"),
    pack(10, "10일 기준", "day10"),
    pack(null, "말일 기준", "monthEnd"),
  ];
}

export function emptyHospitalRow(
  id: string,
  name = "",
  amount = 0,
  contractStatus: ContractStatus = "외주",
  expectedDay: number | null = null
): HospitalMonthRow {
  return {
    id,
    name,
    contractStatus,
    amount,
    expectedDay,
    status: "unpaid",
  };
}

export function emptyExpenseRow(
  id: string,
  name = "",
  amount = 0,
  payDay: number | null = null,
  source: ExpenseSource = "manual",
  dailyAmount?: number
): ExpenseMonthRow {
  return {
    id,
    name,
    amount,
    paidAmount: 0,
    note: "",
    payDay,
    source,
    status: "unpaid",
    excluded: false,
    ...(dailyAmount && dailyAmount > 0 ? { dailyAmount } : {}),
  };
}

/** 지급액 변경 시 status 동기화 */
export function withExpensePaidAmount(
  row: ExpenseMonthRow,
  paidAmount: number
): ExpenseMonthRow {
  const amount = Math.max(0, Math.floor(row.amount || 0));
  const paid = Math.min(amount, Math.max(0, Math.floor(paidAmount || 0)));
  return {
    ...row,
    paidAmount: paid,
    status: amount > 0 && paid >= amount ? "paid" : "unpaid",
  };
}

export function emptyMiscRow(
  id: string,
  name = "",
  amount = 0,
  expectedDay: number | null = null
): MiscCollectionRow {
  return {
    id,
    name,
    amount,
    expectedDay,
    status: "unpaid",
  };
}
