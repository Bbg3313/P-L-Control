import {
  createEmptyCashflow,
  type CashflowMonth,
  type CashflowSnapshot,
  type CollectionStatus,
  type ContractStatus,
  type ExpenseMonthRow,
  type ExpenseSource,
  type ExpenseTemplate,
  type HospitalMonthRow,
  type HospitalTemplate,
} from "@/lib/cashflow-types";

function isYearMonth(key: string): boolean {
  return /^\d{4}-\d{2}$/.test(key);
}

function asMoney(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function asStatus(value: unknown): CollectionStatus {
  if (value === "paid") return "paid";
  // 구버전 partial → 미수로
  return "unpaid";
}

function asDay(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.floor(value);
  if (n < 1 || n > 31) return null;
  return n;
}

function asContractStatus(value: unknown): ContractStatus {
  if (
    value === "외주" ||
    value === "자체" ||
    value === "보류" ||
    value === "해지"
  ) {
    return value;
  }
  return "외주";
}

function asExpenseSource(value: unknown): ExpenseSource {
  if (
    value === "payroll-bbg" ||
    value === "payroll-goldfender" ||
    value === "fixed-th" ||
    value === "fixed-vn" ||
    value === "meta-daily" ||
    value === "manual"
  ) {
    return value;
  }
  return "manual";
}

function asPayDay(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.floor(value);
  if (n < 1 || n > 31) return null;
  return n;
}

function normalizeHospitalTemplate(raw: unknown): HospitalTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!id || !name) return null;
  return {
    id,
    name,
    defaultAmount: asMoney(o.defaultAmount),
    expectedDay: asDay(o.expectedDay),
    contractStatus: asContractStatus(o.contractStatus),
  };
}

function normalizeExpenseTemplate(raw: unknown): ExpenseTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!id || !name) return null;
  const dailyAmount = asMoney(o.dailyAmount);
  return {
    id,
    name,
    defaultAmount: asMoney(o.defaultAmount),
    payDay: asPayDay(o.payDay),
    source: asExpenseSource(o.source),
    ...(dailyAmount > 0 ? { dailyAmount } : {}),
  };
}

function normalizeHospitalRow(raw: unknown): HospitalMonthRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!id) return null;

  let expectedDay = asDay(o.expectedDay);
  // 구버전 paidDate(YYYY-MM-DD) → 일자만
  if (
    expectedDay == null &&
    typeof o.paidDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(o.paidDate)
  ) {
    expectedDay = asDay(Number(o.paidDate.slice(8, 10)));
  }

  let status = asStatus(o.status);
  // 구버전: 입금액이 청구액 이상이면 입금완료
  const amount = asMoney(o.amount);
  const received = asMoney(o.receivedAmount);
  if (o.status === "partial") status = "unpaid";
  if (status !== "paid" && amount > 0 && received >= amount) status = "paid";

  return {
    id,
    name,
    contractStatus: asContractStatus(o.contractStatus),
    amount,
    expectedDay,
    status,
  };
}

function normalizeExpenseRow(raw: unknown): ExpenseMonthRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!id) return null;
  const dailyAmount = asMoney(o.dailyAmount);
  return {
    id,
    name: typeof o.name === "string" ? o.name.trim() : "",
    amount: asMoney(o.amount),
    note: typeof o.note === "string" ? o.note : "",
    payDay: asPayDay(o.payDay),
    source: asExpenseSource(o.source),
    ...(dailyAmount > 0 ? { dailyAmount } : {}),
  };
}

function normalizeMonth(
  yearMonth: string,
  raw: unknown
): CashflowMonth | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const hospitals = Array.isArray(o.hospitals)
    ? o.hospitals
        .map(normalizeHospitalRow)
        .filter((r): r is HospitalMonthRow => Boolean(r))
    : [];
  const expenses = Array.isArray(o.expenses)
    ? o.expenses
        .map(normalizeExpenseRow)
        .filter((r): r is ExpenseMonthRow => Boolean(r))
    : [];
  return { yearMonth, hospitals, expenses };
}

export function normalizeCashflowSnapshot(
  raw: Partial<CashflowSnapshot> | null | undefined
): CashflowSnapshot {
  const hospitals = Array.isArray(raw?.hospitals)
    ? raw!.hospitals
        .map(normalizeHospitalTemplate)
        .filter((h): h is HospitalTemplate => Boolean(h))
    : [];
  const expenseTemplates = Array.isArray(raw?.expenseTemplates)
    ? raw!.expenseTemplates
        .map(normalizeExpenseTemplate)
        .filter((e): e is ExpenseTemplate => Boolean(e))
    : [];

  const months: Record<string, CashflowMonth> = {};
  if (raw?.months && typeof raw.months === "object") {
    for (const [ym, value] of Object.entries(raw.months)) {
      if (!isYearMonth(ym)) continue;
      const month = normalizeMonth(ym, value);
      if (month) months[ym] = month;
    }
  }

  return {
    hospitals,
    expenseTemplates,
    months,
    seedVersion:
      typeof raw?.seedVersion === "number" && Number.isFinite(raw.seedVersion)
        ? Math.floor(raw.seedVersion)
        : 0,
    updatedAt:
      typeof raw?.updatedAt === "string" && raw.updatedAt
        ? raw.updatedAt
        : new Date().toISOString(),
  };
}

export function hasCashflowData(snapshot: CashflowSnapshot): boolean {
  return (
    snapshot.hospitals.length > 0 ||
    snapshot.expenseTemplates.length > 0 ||
    Object.keys(snapshot.months).length > 0
  );
}

export { createEmptyCashflow };
