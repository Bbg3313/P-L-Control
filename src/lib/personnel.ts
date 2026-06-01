import { getMonthlyNonTaxableAllowance } from "@/lib/non-taxable-allowance";
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
  /** 직접 입력 월 비용(원) */
  directMonthlyAmount: number;
  /** 급여 모드: 입력 금액 */
  salaryAmount: number;
  salaryBasis: SalaryBasis;
}

export function isOverseasTeam(name: string): boolean {
  return OVERSEAS_TEAM_NAMES.has(name);
}

export function createDefaultPersonnel(): PersonnelEntry[] {
  return FIXED_PERSONNEL_NAMES.map((name) => ({
    id: name,
    name,
    inputMode: "direct" as const,
    directMonthlyAmount: 0,
    salaryAmount: 0,
    salaryBasis: "monthly" as const,
  }));
}

export function getPersonnelMonthlyCost(entry: PersonnelEntry): number {
  if (entry.inputMode === "direct") {
    return entry.directMonthlyAmount > 0 ? entry.directMonthlyAmount : 0;
  }

  if (entry.salaryAmount <= 0) return 0;

  if (isOverseasTeam(entry.name)) {
    return entry.salaryBasis === "monthly"
      ? entry.salaryAmount
      : Math.floor(entry.salaryAmount / 12);
  }

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

    return FIXED_PERSONNEL_NAMES.map((name) => {
      const existing = byName.get(name);
      if (existing) {
        return {
          id: existing.id || name,
          name,
          inputMode: existing.inputMode === "salary" ? "salary" : "direct",
          directMonthlyAmount: Number(existing.directMonthlyAmount) || 0,
          salaryAmount: Number(existing.salaryAmount) || 0,
          salaryBasis:
            existing.salaryBasis === "annual" ? "annual" : "monthly",
        };
      }
      return {
        id: name,
        name,
        inputMode: "direct" as const,
        directMonthlyAmount: 0,
        salaryAmount: 0,
        salaryBasis: "monthly" as const,
      };
    });
  } catch {
    return createDefaultPersonnel();
  }
}
