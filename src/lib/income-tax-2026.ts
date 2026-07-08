/**
 * 2026년 근로소득 원천징수 소득세 (간이세액표 기준)
 * - 비과세 제외 월급여액으로 2026.3.1 개정 간이세액표 조회
 * - 4대보험 근로자 부담분은 소득세 산출 전 공제하지 않음 (표 기준과 동일)
 */

import { lookupSimplifiedWithholdingTax } from "@/lib/simplified-tax-table-2026";
import { monthlyGrossFromSalary } from "@/lib/social-insurance-jun-2026";

const PENSION_EMPLOYEE_RATE = 0.0475;
const PENSION_FLOOR = 400_000;
const PENSION_CEILING = 6_370_000;

function truncateWon(amount: number): number {
  return Math.floor(amount);
}

function clampPensionBase(monthlyGross: number): number {
  return Math.min(Math.max(monthlyGross, PENSION_FLOOR), PENSION_CEILING);
}

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

  const pensionBase = clampPensionBase(insuranceBase);
  const pension = truncateWon(pensionBase * PENSION_EMPLOYEE_RATE);

  const healthTotal = truncateWon(insuranceBase * 0.0719);
  const health = truncateWon(healthTotal / 2);
  const longTermCare = truncateWon((healthTotal * 0.1314) / 2);
  const employment = truncateWon(insuranceBase * 0.009);

  return {
    pension,
    health,
    longTermCare,
    employment,
    total: pension + health + longTermCare + employment,
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
