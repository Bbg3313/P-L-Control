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
  /** 해당 기준일까지 예정·실수금(활성 계약 청구액) */
  received: number;
  expenses: number;
  /** 수금 − 비용. 음수면 부족(더 필요), 양수면 여유(남음) */
  net: number;
}

/** 활성 계약 중 예정일이 maxDay 이하인 청구액 합(미수 포함 — 현금 계획용) */
export function sumExpectedByDayLimit(
  hospitals: HospitalMonthRow[],
  maxDay: number
): number {
  let total = 0;
  for (const row of hospitals) {
    if (!isActiveContract(row.contractStatus)) continue;
    const day = row.expectedDay ?? 31;
    if (day <= maxDay) {
      total += Math.max(0, Math.floor(row.amount || 0));
    }
  }
  return total;
}

/** 기타 수금 중 예정일이 maxDay 이하인 금액 합 */
export function sumMiscExpectedByDayLimit(
  rows: MiscCollectionRow[],
  maxDay: number
): number {
  let total = 0;
  for (const row of rows) {
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

  let billedTotal = 0;
  let receivedTotal = 0;
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
    billedTotal += billed;
    if (row.status === "paid") {
      receivedTotal += billed;
      paidCount += 1;
    } else {
      unpaidCount += 1;
    }
  }

  // 기타 수금 = 예상 추가매출 (병원 미수와 별도). 입금된 건만 수금에 합산
  let miscBilledTotal = 0;
  let miscReceivedTotal = 0;
  for (const row of misc) {
    const billed = Math.max(0, Math.floor(row.amount || 0));
    miscBilledTotal += billed;
    if (row.status === "paid") {
      miscReceivedTotal += billed;
      receivedTotal += billed;
    }
  }

  let expenseTotal = 0;
  let unpaidExpenseTotal = 0;
  let expensePaidCount = 0;
  let expenseUnpaidCount = 0;
  for (const row of expenses) {
    const amount = Math.max(0, Math.floor(row.amount || 0));
    expenseTotal += amount;
    if (row.status === "paid") {
      expensePaidCount += 1;
    } else {
      expenseUnpaidCount += 1;
      unpaidExpenseTotal += amount;
    }
  }

  return {
    billedTotal,
    receivedTotal,
    unpaidTotal: Math.max(0, billedTotal - receivedTotal),
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

/**
 * 해당 기준일까지 비용.
 * maxDay null = 말일(전체). 일별 비용은 일수×단가.
 * unpaidOnly: 미지급만 (기지급 제외 — ‘더 필요’ 계산용)
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
    if (unpaidOnly && row.status === "paid") continue;

    if (row.source === "meta-daily" || (row.dailyAmount && row.dailyAmount > 0)) {
      const daily = Math.max(
        0,
        Math.floor(row.dailyAmount || 0) ||
          Math.floor((row.amount || 0) / daysInMonth)
      );
      if (daily <= 0) continue;
      if (maxDay == null) {
        total += daily * daysInMonth;
      } else {
        total += daily * Math.min(maxDay, daysInMonth);
      }
      continue;
    }

    const amount = Math.max(0, Math.floor(row.amount || 0));
    if (amount <= 0) continue;
    if (maxDay == null) {
      total += amount;
      continue;
    }
    const payDay = row.payDay ?? 31;
    if (payDay <= maxDay) total += amount;
  }
  return total;
}

export function buildCheckpoints(
  month: CashflowMonth | null
): CheckpointSummary[] {
  const hospitals = month?.hospitals ?? [];
  const expenses = month?.expenses ?? [];
  const misc = month?.miscCollections ?? [];
  const ym = month?.yearMonth;

  const startIn =
    sumExpectedByDayLimit(hospitals, 1) + sumMiscExpectedByDayLimit(misc, 1);
  const day10In =
    sumExpectedByDayLimit(hospitals, 10) + sumMiscExpectedByDayLimit(misc, 10);
  const endIn =
    hospitals.reduce((sum, row) => {
      if (!isActiveContract(row.contractStatus)) return sum;
      return sum + Math.max(0, Math.floor(row.amount || 0));
    }, 0) +
    misc.reduce(
      (sum, row) => sum + Math.max(0, Math.floor(row.amount || 0)),
      0
    );

  // 기지급은 이미 나갔으므로 ‘더 필요’에는 미지급만 반영
  const startExp = sumExpensesByPayDayLimit(expenses, 1, ym, true);
  const day10Exp = sumExpensesByPayDayLimit(expenses, 10, ym, true);
  const endExp = sumExpensesByPayDayLimit(expenses, null, ym, true);

  return [
    {
      key: "start",
      label: "1일 기준",
      received: startIn,
      expenses: startExp,
      net: startIn - startExp,
    },
    {
      key: "day10",
      label: "10일 기준",
      received: day10In,
      expenses: day10Exp,
      net: day10In - day10Exp,
    },
    {
      key: "monthEnd",
      label: "말일 기준",
      received: endIn,
      expenses: endExp,
      net: endIn - endExp,
    },
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
    note: "",
    payDay,
    source,
    status: "unpaid",
    ...(dailyAmount && dailyAmount > 0 ? { dailyAmount } : {}),
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
