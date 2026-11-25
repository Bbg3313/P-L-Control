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
    const payDay = row.payDay ?? 31;
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
    const payDay = row.payDay ?? 31;
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
  day: number
): Omit<DailyCashflowPoint, "day" | "label"> {
  const paidReceived =
    sumReceivedByDayLimit(hospitals, day) +
    sumMiscExpectedByDayLimit(misc, day, { paidOnly: true });
  const unpaidReceived =
    sumExpectedByDayLimit(hospitals, day, true) +
    sumMiscExpectedByDayLimit(misc, day, { unpaidOnly: true });
  const received = paidReceived + unpaidReceived;
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
    const day = maxDay ?? daysInCashflowMonth(ym);
    return {
      key,
      label,
      ...packDayCashflow(hospitals, expenses, misc, ym, day),
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
