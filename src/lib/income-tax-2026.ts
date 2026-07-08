/**
 * 2026년 근로소득 간이세액 산출 (원천징수 추정)
 * - 4대보험 근로자 부담 공제 후 연환산·근로소득공제·기본공제·세율·근로소득세액공제 적용
 */

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

/** 과세표준(보수월액) 기준 월 원천징수 소득세 */
export function calcMonthlyWithholdingTaxFromInsuranceBase(
  insuranceBase: number
): number {
  if (insuranceBase <= 0) return 0;

  const employeeInsurance =
    calcEmployeeInsuranceFromInsuranceBase(insuranceBase);
  const monthlyEarned = Math.max(0, insuranceBase - employeeInsurance);
  const annualEarned = monthlyEarned * 12;

  const earnedIncomeDeduction = calcEarnedIncomeDeduction(annualEarned);
  const basicDeduction = 1_500_000;
  const taxable = Math.max(
    0,
    annualEarned - earnedIncomeDeduction - basicDeduction
  );

  const annualTaxBeforeCredit = calcTaxOnAnnualTaxable(taxable);
  const annualCredit = calcEarnedIncomeTaxCredit(
    annualTaxBeforeCredit,
    annualEarned
  );
  const annualTax = Math.max(0, annualTaxBeforeCredit - annualCredit);

  return truncateWon(annualTax / 12);
}

/** 근로소득공제 (연간 총급여 기준) */
function calcEarnedIncomeDeduction(annualEarned: number): number {
  if (annualEarned <= 5_000_000) {
    return truncateWon(annualEarned * 0.7);
  }
  if (annualEarned <= 15_000_000) {
    return 3_500_000 + truncateWon((annualEarned - 5_000_000) * 0.4);
  }
  if (annualEarned <= 45_000_000) {
    return 7_500_000 + truncateWon((annualEarned - 15_000_000) * 0.15);
  }
  if (annualEarned <= 100_000_000) {
    return 12_000_000 + truncateWon((annualEarned - 45_000_000) * 0.05);
  }
  return 14_750_000 + truncateWon((annualEarned - 100_000_000) * 0.02);
}

/** 산출세액 (연간 과세표준, 본인 1인 기본공제) */
function calcTaxOnAnnualTaxable(taxable: number): number {
  if (taxable <= 0) return 0;
  if (taxable <= 14_000_000) {
    return truncateWon(taxable * 0.06);
  }
  if (taxable <= 50_000_000) {
    return 840_000 + truncateWon((taxable - 14_000_000) * 0.15);
  }
  if (taxable <= 88_000_000) {
    return 6_240_000 + truncateWon((taxable - 50_000_000) * 0.24);
  }
  if (taxable <= 150_000_000) {
    return 15_360_000 + truncateWon((taxable - 88_000_000) * 0.35);
  }
  if (taxable <= 300_000_000) {
    return 37_060_000 + truncateWon((taxable - 150_000_000) * 0.38);
  }
  if (taxable <= 500_000_000) {
    return 94_060_000 + truncateWon((taxable - 300_000_000) * 0.4);
  }
  if (taxable <= 1_000_000_000) {
    return 174_060_000 + truncateWon((taxable - 500_000_000) * 0.42);
  }
  return 384_060_000 + truncateWon((taxable - 1_000_000_000) * 0.45);
}

/** 근로소득세액공제 (연간 총급여 기준, 2024~ 근사) */
function calcEarnedIncomeTaxCredit(annualTax: number, annualEarned: number): number {
  if (annualTax <= 0 || annualEarned <= 0) return 0;

  let credit = 0;
  if (annualEarned <= 33_000_000) {
    credit = Math.min(truncateWon(annualTax * 0.55), 740_000);
  } else if (annualEarned <= 70_000_000) {
    credit = Math.max(
      0,
      740_000 - truncateWon((annualEarned - 33_000_000) * 0.008)
    );
  } else if (annualEarned <= 120_000_000) {
    credit = Math.max(
      0,
      660_000 - truncateWon((annualEarned - 70_000_000) * 0.5)
    );
  }

  return Math.min(credit, annualTax);
}

/** 월 근로소득 원천징수 소득세 (추정) */
export function calcMonthlyWithholdingTax(
  monthlyGross: number,
  nonTaxableMonthly = 0
): number {
  if (monthlyGross <= 0) return 0;

  const insuranceBase = Math.max(0, monthlyGross - nonTaxableMonthly);
  const employeeInsurance =
    calcEmployeeInsuranceFromInsuranceBase(insuranceBase);
  const monthlyEarned = insuranceBase - employeeInsurance;
  const annualEarned = monthlyEarned * 12;

  const earnedIncomeDeduction = calcEarnedIncomeDeduction(annualEarned);
  const basicDeduction = 1_500_000;
  const taxable = Math.max(
    0,
    annualEarned - earnedIncomeDeduction - basicDeduction
  );

  const annualTaxBeforeCredit = calcTaxOnAnnualTaxable(taxable);
  const annualCredit = calcEarnedIncomeTaxCredit(
    annualTaxBeforeCredit,
    annualEarned
  );
  const annualTax = Math.max(0, annualTaxBeforeCredit - annualCredit);

  return truncateWon(annualTax / 12);
}

export function monthlyGrossFromPersonnelSalary(
  salaryAmount: number,
  basis: "monthly" | "annual"
): number {
  return monthlyGrossFromSalary(salaryAmount, basis);
}
