export const PAYROLL_OVERRIDES_STORAGE_KEY =
  "pl-control-payroll-taxable-overrides-v1";

/** YYYY-MM → personId → 과세표준(보수월액) */
export type PayrollTaxableOverrides = Record<string, Record<string, number>>;

export function loadPayrollTaxableOverrides(): PayrollTaxableOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PAYROLL_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PayrollTaxableOverrides;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function savePayrollTaxableOverrides(data: PayrollTaxableOverrides): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PAYROLL_OVERRIDES_STORAGE_KEY, JSON.stringify(data));
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

export function setTaxableOverride(
  overrides: PayrollTaxableOverrides,
  yearMonth: string,
  personId: string,
  value: number | null
): PayrollTaxableOverrides {
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
