export const PAYROLL_OVERRIDES_STORAGE_KEY =
  "pl-control-payroll-taxable-overrides-v1";

export const PAYROLL_PERFORMANCE_PAY_STORAGE_KEY =
  "pl-control-payroll-performance-pay-v1";

export const PAYROLL_NOTE_STORAGE_KEY = "pl-control-payroll-notes-v1";

/** YYYY-MM → personId → 과세표준(보수월액) */
export type PayrollTaxableOverrides = Record<string, Record<string, number>>;

/** YYYY-MM → personId → 성과급(원) */
export type PayrollPerformancePayOverrides = Record<
  string,
  Record<string, number>
>;

/** YYYY-MM → personId → 비고 */
export type PayrollNoteOverrides = Record<string, Record<string, string>>;

function readJsonRecord<T extends Record<string, unknown>>(
  key: string
): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function loadPayrollTaxableOverrides(): PayrollTaxableOverrides {
  return readJsonRecord<PayrollTaxableOverrides>(PAYROLL_OVERRIDES_STORAGE_KEY) ?? {};
}

export function savePayrollTaxableOverrides(data: PayrollTaxableOverrides): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PAYROLL_OVERRIDES_STORAGE_KEY, JSON.stringify(data));
}

export function loadPayrollPerformancePayOverrides(): PayrollPerformancePayOverrides {
  return (
    readJsonRecord<PayrollPerformancePayOverrides>(
      PAYROLL_PERFORMANCE_PAY_STORAGE_KEY
    ) ?? {}
  );
}

export function savePayrollPerformancePayOverrides(
  data: PayrollPerformancePayOverrides
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PAYROLL_PERFORMANCE_PAY_STORAGE_KEY, JSON.stringify(data));
}

export function loadPayrollNoteOverrides(): PayrollNoteOverrides {
  return readJsonRecord<PayrollNoteOverrides>(PAYROLL_NOTE_STORAGE_KEY) ?? {};
}

export function savePayrollNoteOverrides(data: PayrollNoteOverrides): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PAYROLL_NOTE_STORAGE_KEY, JSON.stringify(data));
}

export function getNoteOverride(
  overrides: PayrollNoteOverrides,
  yearMonth: string,
  personId: string
): string | undefined {
  const month = overrides[yearMonth];
  if (!month) return undefined;
  const value = month[personId];
  return typeof value === "string" ? value : undefined;
}

function setMonthPersonStringOverride(
  overrides: Record<string, Record<string, string>>,
  yearMonth: string,
  personId: string,
  value: string | null
): Record<string, Record<string, string>> {
  const next = { ...overrides };
  const month = { ...(next[yearMonth] ?? {}) };

  if (value === null || value.trim() === "") {
    delete month[personId];
  } else {
    month[personId] = value.trim();
  }

  if (Object.keys(month).length === 0) {
    const nextMonth = { ...next };
    delete nextMonth[yearMonth];
    return nextMonth;
  }

  next[yearMonth] = month;
  return next;
}

export function setNoteOverride(
  overrides: PayrollNoteOverrides,
  yearMonth: string,
  personId: string,
  value: string | null
): PayrollNoteOverrides {
  return setMonthPersonStringOverride(overrides, yearMonth, personId, value);
}

export function getTaxableOverride(
  overrides: PayrollTaxableOverrides,
  yearMonth: string,
  personId: string
): number | undefined {
  const month = overrides[yearMonth];
  if (!month) return undefined;
  const value = month[personId];
  return typeof value === "number" && value >= 0 ? value : undefined;
}

export function getPerformancePayOverride(
  overrides: PayrollPerformancePayOverrides,
  yearMonth: string,
  personId: string
): number | undefined {
  const month = overrides[yearMonth];
  if (!month) return undefined;
  const value = month[personId];
  return typeof value === "number" && value >= 0 ? value : undefined;
}

function setMonthPersonOverride(
  overrides: Record<string, Record<string, number>>,
  yearMonth: string,
  personId: string,
  value: number | null
): Record<string, Record<string, number>> {
  const next = { ...overrides };
  const month = { ...(next[yearMonth] ?? {}) };

  if (value === null) {
    delete month[personId];
  } else {
    month[personId] = Math.max(0, Math.floor(value));
  }

  if (Object.keys(month).length === 0) {
    const nextMonth = { ...next };
    delete nextMonth[yearMonth];
    return nextMonth;
  }

  next[yearMonth] = month;
  return next;
}

export function setTaxableOverride(
  overrides: PayrollTaxableOverrides,
  yearMonth: string,
  personId: string,
  value: number | null
): PayrollTaxableOverrides {
  return setMonthPersonOverride(overrides, yearMonth, personId, value);
}

export function setPerformancePayOverride(
  overrides: PayrollPerformancePayOverrides,
  yearMonth: string,
  personId: string,
  value: number | null
): PayrollPerformancePayOverrides {
  return setMonthPersonOverride(overrides, yearMonth, personId, value);
}

export interface PayrollOverridesSnapshot {
  performancePay: PayrollPerformancePayOverrides;
  notes: PayrollNoteOverrides;
  updatedAt: string;
}

/** local을 채우고 cloud가 같은 키면 cloud 우선 */
export function mergePayrollOverrides(
  cloud: PayrollOverridesSnapshot,
  local: PayrollOverridesSnapshot
): PayrollOverridesSnapshot {
  const monthsPay = Array.from(
    new Set([
      ...Object.keys(local.performancePay),
      ...Object.keys(cloud.performancePay),
    ])
  );
  const performancePay: PayrollPerformancePayOverrides = {};
  for (const m of monthsPay) {
    const merged = {
      ...(local.performancePay[m] ?? {}),
      ...(cloud.performancePay[m] ?? {}),
    };
    if (Object.keys(merged).length > 0) performancePay[m] = merged;
  }

  const monthsNotes = Array.from(
    new Set([...Object.keys(local.notes), ...Object.keys(cloud.notes)])
  );
  const notes: PayrollNoteOverrides = {};
  for (const m of monthsNotes) {
    const merged = {
      ...(local.notes[m] ?? {}),
      ...(cloud.notes[m] ?? {}),
    };
    if (Object.keys(merged).length > 0) notes[m] = merged;
  }

  return {
    performancePay,
    notes,
    updatedAt: new Date().toISOString(),
  };
}
