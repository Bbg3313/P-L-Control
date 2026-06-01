import { getMonthlyNonTaxableAllowance } from "@/lib/non-taxable-allowance";
import { getOverseasMonthlyKrw } from "@/lib/overseas-fx";

export {
  calcOverseasMonthlyKrw,
  formatForeignAmount,
  getOverseasCurrency,
  getOverseasCurrencyLabel,
  type OverseasCurrency,
  type OverseasFxBreakdown,
} from "@/lib/overseas-fx";
import {
  calcEmployerCostFromSalary,
  type EmployerInsuranceBreakdown,
} from "@/lib/social-insurance-jun-2026";

export {
  getMonthlyNonTaxableAllowance,
  MONTHLY_NON_TAXABLE_ALLOWANCE,
  MONTHLY_NON_TAXABLE_ALLOWANCE_40,
  NON_TAXABLE_ALLOWANCE_NAMES,
} from "@/lib/non-taxable-allowance";
import {
  calcYouthTaxReliefBreakdown,
  isYouthIncomeTaxReliefEligible,
  type YouthTaxReliefBreakdown,
} from "@/lib/youth-income-tax-relief";

export {
  isYouthIncomeTaxReliefEligible,
  YOUTH_TAX_RELIEF_NAMES,
} from "@/lib/youth-income-tax-relief";

export const PERSONNEL_STORAGE_KEY = "pl-control-personnel-v1";

export const FIXED_PERSONNEL_NAMES = [
  "성수린",
  "박양근",
  "안효재",
  "니키",
  "아리",
  "김소연",
  "정수민",
  "태국현지팀",
  "베트남현지팀",
] as const;

/** 현지팀 등 — 한국 4대보험 미적용 */
const OVERSEAS_TEAM_NAMES = new Set<string>(["태국현지팀", "베트남현지팀"]);

export type PersonnelInputMode = "direct" | "salary";
export type SalaryBasis = "monthly" | "annual";

export interface PersonnelEntry {
  id: string;
  name: string;
  inputMode: PersonnelInputMode;
  /** 직접 입력 — 국내: 원화 월 / 해외: 현지통화 월 */
  directMonthlyAmount: number;
  /** 급여 모드 — 국내: 원화 / 해외: 현지통화 */
  salaryAmount: number;
  salaryBasis: SalaryBasis;
  /** 해외팀: 1 현지통화당 원화 환율 */
  exchangeRateToKrw: number;
  /** 해외팀: 환율 기준일 (YYYY-MM-DD) */
  exchangeRateDate: string;
}

export function isOverseasTeam(name: string): boolean {
  return OVERSEAS_TEAM_NAMES.has(name);
}

/** 태국·베트남: 월급 / 국내 직원: 연봉 */
export function getDefaultSalaryBasis(name: string): SalaryBasis {
  return isOverseasTeam(name) ? "monthly" : "annual";
}

function defaultExchangeRateDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createDefaultPersonnel(): PersonnelEntry[] {
  return FIXED_PERSONNEL_NAMES.map((name) => ({
    id: name,
    name,
    inputMode: "direct" as const,
    directMonthlyAmount: 0,
    salaryAmount: 0,
    salaryBasis: getDefaultSalaryBasis(name),
    exchangeRateToKrw: 0,
    exchangeRateDate: defaultExchangeRateDate(),
  }));
}

function normalizePersonnelEntry(
  name: string,
  existing?: Partial<PersonnelEntry>
): PersonnelEntry {
  return {
    id: existing?.id || name,
    name,
    inputMode: existing?.inputMode === "salary" ? "salary" : "direct",
    directMonthlyAmount: Number(existing?.directMonthlyAmount) || 0,
    salaryAmount: Number(existing?.salaryAmount) || 0,
    salaryBasis: getDefaultSalaryBasis(name),
    exchangeRateToKrw: Number(existing?.exchangeRateToKrw) || 0,
    exchangeRateDate: existing?.exchangeRateDate || defaultExchangeRateDate(),
  };
}

export function getPersonnelMonthlyCost(entry: PersonnelEntry): number {
  if (isOverseasTeam(entry.name)) {
    return getOverseasMonthlyKrw(entry);
  }

  if (entry.inputMode === "direct") {
    return entry.directMonthlyAmount > 0 ? entry.directMonthlyAmount : 0;
  }

  if (entry.salaryAmount <= 0) return 0;

  const nonTaxable = getMonthlyNonTaxableAllowance(entry.name);
  return calcEmployerCostFromSalary(
    entry.salaryAmount,
    entry.salaryBasis,
    nonTaxable
  ).totalMonthlyEmployerCost;
}

export interface PersonnelSalaryBreakdown {
  employer: EmployerInsuranceBreakdown;
  youthTaxRelief: YouthTaxReliefBreakdown | null;
}

export function getPersonnelInsuranceBreakdown(
  entry: PersonnelEntry
): EmployerInsuranceBreakdown | null {
  return getPersonnelSalaryBreakdown(entry)?.employer ?? null;
}

export function getPersonnelSalaryBreakdown(
  entry: PersonnelEntry
): PersonnelSalaryBreakdown | null {
  if (
    entry.inputMode !== "salary" ||
    entry.salaryAmount <= 0 ||
    isOverseasTeam(entry.name)
  ) {
    return null;
  }

  const nonTaxable = getMonthlyNonTaxableAllowance(entry.name);
  const employer = calcEmployerCostFromSalary(
    entry.salaryAmount,
    entry.salaryBasis,
    nonTaxable
  );

  const youthTaxRelief = isYouthIncomeTaxReliefEligible(entry.name)
    ? calcYouthTaxReliefBreakdown(employer.monthlyGross, nonTaxable)
    : null;

  return { employer, youthTaxRelief };
}

export function getPersonnelTotalMonthly(personnel: PersonnelEntry[]): number {
  return personnel.reduce((sum, p) => sum + getPersonnelMonthlyCost(p), 0);
}

export function loadPersonnelFromStorage(): PersonnelEntry[] {
  if (typeof window === "undefined") return createDefaultPersonnel();

  try {
    const raw = localStorage.getItem(PERSONNEL_STORAGE_KEY);
    if (!raw) return createDefaultPersonnel();

    const parsed = JSON.parse(raw) as PersonnelEntry[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return createDefaultPersonnel();
    }

    const byName = new Map(parsed.map((p) => [p.name, p]));

    return FIXED_PERSONNEL_NAMES.map((name) =>
      normalizePersonnelEntry(name, byName.get(name))
    );
  } catch {
    return createDefaultPersonnel();
  }
}
