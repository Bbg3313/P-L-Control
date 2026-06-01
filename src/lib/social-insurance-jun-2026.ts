/**
 * 2026년 6월분 직장가입자 4대보험 — 사업주(회사) 부담분
 *
 * 기준:
 * - 국민연금 상·하한: 2025.7.1~2026.6.30 (40만~637만)
 * - 국민연금 요율 9.5% (사업주 4.75%)
 * - 건강보험 7.19% (사업주 3.595%), 장기요양 건강보험료의 13.14%
 * - 고용보험 실업급여 0.9% + 고용안정·직능개발 0.25% (150인 미만)
 * - 산재보험: 업종 요율 + 출퇴근 0.6‰ + 임금채권 0.6‰ (천분율)
 */

export const JUN_2026_INSURANCE_LABEL = "2026년 6월분 기준";

const PENSION_EMPLOYER_RATE = 0.0475;
const PENSION_FLOOR = 400_000;
const PENSION_CEILING = 6_370_000;

const HEALTH_TOTAL_RATE = 0.0719;
const LONG_TERM_CARE_ON_HEALTH = 0.1314;

const EMPLOYMENT_UNEMPLOYMENT_EMPLOYER = 0.009;
/** 150인 미만 사업장 */
const EMPLOYMENT_STABILITY_EMPLOYER = 0.0025;

/** 사무·서비스업 근사 업종 요율(‰) + 출퇴근 0.6 + 임금채권 0.6 */
const INDUSTRIAL_ACCIDENT_TOTAL_PERMILLE = 2.0;

function truncateWon(amount: number): number {
  return Math.floor(amount);
}

function clampPensionBase(monthlyGross: number): number {
  return Math.min(Math.max(monthlyGross, PENSION_FLOOR), PENSION_CEILING);
}

export interface EmployerInsuranceBreakdown {
  monthlyGross: number;
  /** 식대 등 비과세 (월) */
  nonTaxableMonthly: number;
  /** 4대보험 산정 보수월액 */
  insuranceBase: number;
  pensionEmployer: number;
  healthEmployer: number;
  longTermCareEmployer: number;
  employmentUnemployment: number;
  employmentStability: number;
  employmentEmployer: number;
  industrialAccidentEmployer: number;
  totalEmployerContributions: number;
  totalMonthlyEmployerCost: number;
}

const ZERO_BREAKDOWN: EmployerInsuranceBreakdown = {
  monthlyGross: 0,
  nonTaxableMonthly: 0,
  insuranceBase: 0,
  pensionEmployer: 0,
  healthEmployer: 0,
  longTermCareEmployer: 0,
  employmentUnemployment: 0,
  employmentStability: 0,
  employmentEmployer: 0,
  industrialAccidentEmployer: 0,
  totalEmployerContributions: 0,
  totalMonthlyEmployerCost: 0,
};

export function monthlyGrossFromSalary(
  salaryAmount: number,
  basis: "monthly" | "annual"
): number {
  if (salaryAmount <= 0) return 0;
  if (basis === "monthly") return salaryAmount;
  return truncateWon(salaryAmount / 12);
}

/** 한국 4대보험 사업주 부담 포함 월 인건비(급여+회사부담) */
export function calcEmployerCostFromMonthlyGross(
  monthlyGross: number,
  nonTaxableMonthly = 0
): EmployerInsuranceBreakdown {
  if (monthlyGross <= 0) return { ...ZERO_BREAKDOWN };

  const insuranceBase = Math.max(0, monthlyGross - nonTaxableMonthly);

  const pensionBase = clampPensionBase(insuranceBase);
  const pensionEmployer = truncateWon(pensionBase * PENSION_EMPLOYER_RATE);

  const healthPremiumTotal = truncateWon(insuranceBase * HEALTH_TOTAL_RATE);
  const healthEmployer = truncateWon(healthPremiumTotal / 2);

  const longTermCareTotal = truncateWon(healthPremiumTotal * LONG_TERM_CARE_ON_HEALTH);
  const longTermCareEmployer = truncateWon(longTermCareTotal / 2);

  const employmentUnemployment = truncateWon(
    insuranceBase * EMPLOYMENT_UNEMPLOYMENT_EMPLOYER
  );
  const employmentStability = truncateWon(
    insuranceBase * EMPLOYMENT_STABILITY_EMPLOYER
  );
  const employmentEmployer = employmentUnemployment + employmentStability;

  const industrialAccidentEmployer = truncateWon(
    (insuranceBase * INDUSTRIAL_ACCIDENT_TOTAL_PERMILLE) / 1000
  );

  const totalEmployerContributions =
    pensionEmployer +
    healthEmployer +
    longTermCareEmployer +
    employmentEmployer +
    industrialAccidentEmployer;

  return {
    monthlyGross,
    nonTaxableMonthly,
    insuranceBase,
    pensionEmployer,
    healthEmployer,
    longTermCareEmployer,
    employmentUnemployment,
    employmentStability,
    employmentEmployer,
    industrialAccidentEmployer,
    totalEmployerContributions,
    totalMonthlyEmployerCost: monthlyGross + totalEmployerContributions,
  };
}

export function calcEmployerCostFromSalary(
  salaryAmount: number,
  basis: "monthly" | "annual",
  nonTaxableMonthly = 0
): EmployerInsuranceBreakdown {
  const monthlyGross = monthlyGrossFromSalary(salaryAmount, basis);
  return calcEmployerCostFromMonthlyGross(monthlyGross, nonTaxableMonthly);
}
