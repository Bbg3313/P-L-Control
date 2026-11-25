import type {
  CashflowMonth,
  CollectionStatus,
  ContractStatus,
  ExpenseMonthRow,
  HospitalMonthRow,
} from "@/lib/cashflow-types";
import { isActiveContract } from "@/lib/cashflow-types";

export interface CashflowSummary {
  billedTotal: number;
  receivedTotal: number;
  unpaidTotal: number;
  expenseTotal: number;
  /** 수금 − 비용 */
  operatingProfit: number;
  paidCount: number;
  unpaidCount: number;
  partialCount: number;
  hospitalCount: number;
  holdCount: number;
  terminatedCount: number;
}

export interface CheckpointSummary {
  key: "start" | "day10" | "monthEnd";
  label: string;
  received: number;
  expenses: number;
  net: number;
}

function dayOf(paidDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) return null;
  return Number(paidDate.slice(8, 10));
}

/** maxDay 이하 입금일만 합산. maxDay null이면 날짜 있는 입금만 */
export function sumReceivedByDayLimit(
  hospitals: HospitalMonthRow[],
  maxDay: number
): number {
  let total = 0;
  for (const row of hospitals) {
    if (!isActiveContract(row.contractStatus)) continue;
    if (row.status === "unpaid") continue;
    const received = Math.max(0, Math.floor(row.receivedAmount || 0));
    if (received <= 0) continue;
    const day = dayOf(row.paidDate);
    if (day == null) continue;
    if (day <= maxDay) total += received;
  }
  return total;
}

export function summarizeMonth(month: CashflowMonth | null): CashflowSummary {
  const hospitals = month?.hospitals ?? [];
  const expenses = month?.expenses ?? [];

  let billedTotal = 0;
  let receivedTotal = 0;
  let paidCount = 0;
  let unpaidCount = 0;
  let partialCount = 0;
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
    const received = Math.max(0, Math.floor(row.receivedAmount || 0));
    billedTotal += billed;
    receivedTotal += received;
    if (row.status === "paid") paidCount += 1;
    else if (row.status === "partial") partialCount += 1;
    else unpaidCount += 1;
  }

  const expenseTotal = expenses.reduce(
    (sum, row) => sum + Math.max(0, Math.floor(row.amount || 0)),
    0
  );

  return {
    billedTotal,
    receivedTotal,
    unpaidTotal: Math.max(0, billedTotal - receivedTotal),
    expenseTotal,
    operatingProfit: receivedTotal - expenseTotal,
    paidCount,
    unpaidCount,
    partialCount,
    hospitalCount: activeCount,
    holdCount,
    terminatedCount,
  };
}

function daysInCashflowMonth(yearMonth: string | undefined): number {
  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) return 30;
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** 해당 기준일까지 나간 비용. maxDay null = 말일(전체). 일별 비용은 일수×단가 */
export function sumExpensesByPayDayLimit(
  expenses: ExpenseMonthRow[],
  maxDay: number | null,
  yearMonth?: string
): number {
  const daysInMonth = daysInCashflowMonth(yearMonth);
  let total = 0;
  for (const row of expenses) {
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
  const ym = month?.yearMonth;

  const day10Received = sumReceivedByDayLimit(hospitals, 10);
  const monthEndReceived = hospitals.reduce((sum, row) => {
    if (!isActiveContract(row.contractStatus)) return sum;
    if (row.status === "unpaid") return sum;
    return sum + Math.max(0, Math.floor(row.receivedAmount || 0));
  }, 0);

  // 월초=1일까지 (임대·AI·Meta 1일치 등)
  const startExp = sumExpensesByPayDayLimit(expenses, 1, ym);
  const day10Exp = sumExpensesByPayDayLimit(expenses, 10, ym);
  const endExp = sumExpensesByPayDayLimit(expenses, null, ym);

  return [
    {
      key: "start",
      label: "월초 (1일)",
      received: 0,
      expenses: startExp,
      net: -startExp,
    },
    {
      key: "day10",
      label: "10일 기준",
      received: day10Received,
      expenses: day10Exp,
      net: day10Received - day10Exp,
    },
    {
      key: "monthEnd",
      label: "말일",
      received: monthEndReceived,
      expenses: endExp,
      net: monthEndReceived - endExp,
    },
  ];
}

export function deriveStatus(
  amount: number,
  receivedAmount: number
): CollectionStatus {
  const billed = Math.max(0, Math.floor(amount || 0));
  const received = Math.max(0, Math.floor(receivedAmount || 0));
  if (received <= 0) return "unpaid";
  if (billed > 0 && received >= billed) return "paid";
  if (received > 0 && received < billed) return "partial";
  return "paid";
}

export function emptyHospitalRow(
  id: string,
  name = "",
  amount = 0,
  contractStatus: ContractStatus = "외주"
): HospitalMonthRow {
  return {
    id,
    name,
    contractStatus,
    amount,
    receivedAmount: 0,
    status: "unpaid",
    paidDate: "",
    note: "",
  };
}

export function emptyExpenseRow(
  id: string,
  name = "",
  amount = 0,
  payDay: number | null = null,
  source: import("@/lib/cashflow-types").ExpenseSource = "manual",
  dailyAmount?: number
): ExpenseMonthRow {
  return {
    id,
    name,
    amount,
    note: "",
    payDay,
    source,
    ...(dailyAmount && dailyAmount > 0 ? { dailyAmount } : {}),
  };
}
