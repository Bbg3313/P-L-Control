/**
 * 2026년 근로소득 원천징수 소득세 (간이세액표 기준)
 * - 비과세 제외 월급여액으로 2026.3.1 개정 간이세액표 조회
 * - 4대보험 근로자 부담분은 소득세 산출 전 공제하지 않음 (표 기준과 동일)
 */

import { lookupSimplifiedWithholdingTax } from "@/lib/simplified-tax-table-2026";
import {
  calcEmploymentUnemploymentShare,
  calcHealthAndLongTermCarePartyShares,
  calcPensionPartyShare,
  getPensionIncomeBase,
  monthlyGrossFromSalary,
} from "@/lib/social-insurance-jun-2026";

/** 4대보험 근로자 부담분 (2026년 6월분 요율, 보수월액 기준) */
export interface EmployeeInsuranceBreakdown {
  pension: number;
  health: number;
  longTermCare: number;
  employment: number;
  total: number;
}

export function calcEmployeeInsuranceBreakdown(
  insuranceBase: number
): EmployeeInsuranceBreakdown {
  if (insuranceBase <= 0) {
    return { pension: 0, health: 0, longTermCare: 0, employment: 0, total: 0 };
  }

  const pensionIncomeBase = getPensionIncomeBase(insuranceBase);
  const pension = calcPensionPartyShare(pensionIncomeBase);
  const { healthParty, longTermCareParty } =
    calcHealthAndLongTermCarePartyShares(insuranceBase);
  const employment = calcEmploymentUnemploymentShare(insuranceBase);

  return {
    pension,
    health: healthParty,
    longTermCare: longTermCareParty,
    employment,
    total: pension + healthParty + longTermCareParty + employment,
  };
}

export function calcEmployeeInsuranceFromInsuranceBase(
  insuranceBase: number
): number {
  return calcEmployeeInsuranceBreakdown(insuranceBase).total;
}

/** 과세표준(비과세 제외 월급여) 기준 간이세액표 소득세 */
export function calcMonthlyWithholdingTaxFromInsuranceBase(
  insuranceBase: number,
  familyCount = 1
): number {
  return lookupSimplifiedWithholdingTax(insuranceBase, familyCount);
}

/**
 * 개인지방소득세 특별징수
 * - 지방세법: 원천징수 소득세의 100분의 10
 * - 국고금관리법·지방회계법: 10원 미만 절사
 */
export function calcLocalIncomeTaxFromIncomeTax(incomeTax: number): number {
  if (incomeTax <= 0) return 0;
  return Math.floor((incomeTax * 0.1) / 10) * 10;
}

/** 월 근로소득 원천징수 소득세 (비과세 식대 등 차감 후) */
export function calcMonthlyWithholdingTax(
  monthlyGross: number,
  nonTaxableMonthly = 0,
  familyCount = 1
): number {
  if (monthlyGross <= 0) return 0;

  const taxableMonthly = Math.max(0, monthlyGross - nonTaxableMonthly);
  return lookupSimplifiedWithholdingTax(taxableMonthly, familyCount);
}

export function monthlyGrossFromPersonnelSalary(
  salaryAmount: number,
  basis: "monthly" | "annual"
): number {
  return monthlyGrossFromSalary(salaryAmount, basis);
}
