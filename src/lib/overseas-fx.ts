import type { PersonnelEntry, SalaryBasis } from "@/lib/personnel";

export type OverseasCurrency = "THB" | "VND";

const CURRENCY_BY_TEAM: Record<string, OverseasCurrency> = {
  태국현지팀: "THB",
  베트남현지팀: "VND",
};

const CURRENCY_LABEL: Record<OverseasCurrency, string> = {
  THB: "바트 (THB)",
  VND: "동 (VND)",
};

const CURRENCY_SYMBOL: Record<OverseasCurrency, string> = {
  THB: "฿",
  VND: "₫",
};

export function getOverseasCurrency(teamName: string): OverseasCurrency | null {
  return CURRENCY_BY_TEAM[teamName] ?? null;
}

export function getOverseasCurrencyLabel(currency: OverseasCurrency): string {
  return CURRENCY_LABEL[currency];
}

export function formatForeignAmount(
  amount: number,
  currency: OverseasCurrency
): string {
  const symbol = CURRENCY_SYMBOL[currency];
  return `${symbol} ${amount.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}`;
}

/** 환율 입력 (소수 허용) */
export function parseExchangeRateInput(value: string): number {
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function formatExchangeRateHint(currency: OverseasCurrency): string {
  if (currency === "THB") return "예: 38.5 (1바트당 원화)";
  return "예: 0.055 (1동당 원화, 100동≈5.5원이면 0.055)";
}

export function getForeignMonthlyAmount(entry: PersonnelEntry): number {
  if (entry.inputMode === "direct") {
    return entry.directMonthlyAmount > 0 ? entry.directMonthlyAmount : 0;
  }
  if (entry.salaryAmount <= 0) return 0;
  return entry.salaryBasis === "monthly"
    ? entry.salaryAmount
    : Math.floor(entry.salaryAmount / 12);
}

export interface OverseasFxBreakdown {
  currency: OverseasCurrency;
  foreignMonthly: number;
  foreignBasis: SalaryBasis | "direct";
  exchangeRateDate: string;
  exchangeRateToKrw: number;
  monthlyKrw: number;
  usesLegacyKrw: boolean;
}

export function calcOverseasMonthlyKrw(entry: PersonnelEntry): OverseasFxBreakdown | null {
  const currency = getOverseasCurrency(entry.name);
  if (!currency) return null;

  const foreignMonthly = getForeignMonthlyAmount(entry);
  const exchangeRateToKrw = entry.exchangeRateToKrw ?? 0;
  const exchangeRateDate = entry.exchangeRateDate || "";

  if (foreignMonthly <= 0) {
    return {
      currency,
      foreignMonthly: 0,
      foreignBasis: entry.inputMode === "direct" ? "direct" : entry.salaryBasis,
      exchangeRateDate,
      exchangeRateToKrw,
      monthlyKrw: 0,
      usesLegacyKrw: false,
    };
  }

  if (exchangeRateToKrw <= 0) {
    return {
      currency,
      foreignMonthly,
      foreignBasis: entry.inputMode === "direct" ? "direct" : entry.salaryBasis,
      exchangeRateDate,
      exchangeRateToKrw: 0,
      monthlyKrw: foreignMonthly,
      usesLegacyKrw: true,
    };
  }

  return {
    currency,
    foreignMonthly,
    foreignBasis: entry.inputMode === "direct" ? "direct" : entry.salaryBasis,
    exchangeRateDate,
    exchangeRateToKrw,
    monthlyKrw: Math.floor(foreignMonthly * exchangeRateToKrw),
    usesLegacyKrw: false,
  };
}

export function getOverseasMonthlyKrw(entry: PersonnelEntry): number {
  return calcOverseasMonthlyKrw(entry)?.monthlyKrw ?? 0;
}
