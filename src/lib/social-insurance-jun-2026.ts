/**
 * 2026년 6월분 직장가입자 4대보험 — 사업주(회사) 부담분
 *
 * 기준:
 * - 국민연금 상·하한: 2025.7.1~2026.6.30 (40만~637만)
 * - 국민연금 기준소득월액: 보수월액 천원 미만 절사 후 상·하한 적용
 * - 국민연금 요율 9.5% (사업주 4.75%)
 * - 건강보험 7.19% (사업주 3.595%), 항목별 원 단위 절사
 * - 장기요양: 건강보험료 합계 × 13.14% 후 원 단위 절사, 근로자·사업주 반분
 * - 고용보험 실업급여 0.9% + 고용안정·직능개발 0.25% (150인 미만)
 * - 산재보험: 업종 요율 + 출퇴근 0.6‰ + 임금채권 0.6‰ (천분율)
 */

export const JUN_2026_INSURANCE_LABEL = "2026년 6월분 기준";

export const PENSION_PARTY_RATE = 0.0475;
const PENSION_FLOOR = 400_000;
const PENSION_CEILING = 6_370_000;

export const HEALTH_TOTAL_RATE = 0.0719;
export const LONG_TERM_CARE_ON_HEALTH = 0.1314;

const EMPLOYMENT_UNEMPLOYMENT_RATE = 0.009;
/** 150인 미만 사업장 */
const EMPLOYMENT_STABILITY_EMPLOYER = 0.0025;

/** 급여대장 공제내역 — 근로자 부담 요율 (호버 안내) */
export const EMPLOYEE_DEDUCTION_RATE_TOOLTIPS = {
  pension: `국민연금 ${(PENSION_PARTY_RATE * 100).toFixed(2)}% (기준소득월액·천원절사)`,
  health: `건강보험 ${((HEALTH_TOTAL_RATE / 2) * 100).toFixed(3)}%`,
  longTermCare: `장기요양 건강보험료×${(LONG_TERM_CARE_ON_HEALTH * 100).toFixed(2)}%÷2`,
  employment: `고용보험 실업급여 ${(EMPLOYMENT_UNEMPLOYMENT_RATE * 100).toFixed(1)}%`,
} as const;

export const GOLDFENDER_DEDUCTION_RATE_TOOLTIPS = {
  ...EMPLOYEE_DEDUCTION_RATE_TOOLTIPS,
  health: `${EMPLOYEE_DEDUCTION_RATE_TOOLTIPS.health} · 십원 미만 절사`,
  longTermCare: `${EMPLOYEE_DEDUCTION_RATE_TOOLTIPS.longTermCare} · 십원 미만 절사`,
} as const;

/** 사무·서비스업 근사 업종 요율(‰) + 출퇴근 0.6 + 임금채권 0.6 */
const INDUSTRIAL_ACCIDENT_TOTAL_PERMILLE = 2.0;

/** 원 단위 미만 절사 */
export function truncateWon(amount: number): number {
  return Math.floor(amount);
}

/** 국민연금 기준소득월액 — 보수월액 천원 미만 절사 후 상·하한 */
export function getPensionIncomeBase(insuranceBase: number): number {
  if (insuranceBase <= 0) return 0;
  const truncatedThousands = truncateWon(insuranceBase / 1000) * 1000;
  return Math.min(
    Math.max(truncatedThousands, PENSION_FLOOR),
    PENSION_CEILING
  );
}

export function calcPensionPartyShare(pensionIncomeBase: number): number {
  return truncateWon(pensionIncomeBase * PENSION_PARTY_RATE);
}

/** 건강·장기요양 보험료 (총액 산출 후 반분, 각 단계 원 단위 절사) */
export function calcHealthAndLongTermCarePartyShares(insuranceBase: number): {
  healthParty: number;
  longTermCareParty: number;
} {
  if (insuranceBase <= 0) {
    return { healthParty: 0, longTermCareParty: 0 };
  }

  const healthPremiumTotal = truncateWon(insuranceBase * HEALTH_TOTAL_RATE);
  const longTermCarePremiumTotal = truncateWon(
    healthPremiumTotal * LONG_TERM_CARE_ON_HEALTH
  );

  return {
    healthParty: truncateWon(healthPremiumTotal / 2),
    longTermCareParty: truncateWon(longTermCarePremiumTotal / 2),
  };
}

export function calcEmploymentUnemploymentShare(insuranceBase: number): number {
  if (insuranceBase <= 0) return 0;
  return truncateWon(insuranceBase * EMPLOYMENT_UNEMPLOYMENT_RATE);
}

/**
 * 골드펜더 건강·장기요양 — 십원 미만 절사
 * (1원 자리까지 버리고 10원 단위로 맞춤)
 */
export function truncateGoldfenderHealthLtc(amount: number): number {
  if (amount <= 0) return 0;
  return Math.floor(Math.floor(amount) / 10) * 10;
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

export function calcEmployerContributionsFromInsuranceBase(insuranceBase: number) {
  if (insuranceBase <= 0) {
    return {
      pensionEmployer: 0,
      healthEmployer: 0,
      longTermCareEmployer: 0,
      employmentUnemployment: 0,
      employmentStability: 0,
      employmentEmployer: 0,
      industrialAccidentEmployer: 0,
      totalEmployerContributions: 0,
    };
  }

  const pensionIncomeBase = getPensionIncomeBase(insuranceBase);
  const pensionEmployer = calcPensionPartyShare(pensionIncomeBase);
  const { healthParty, longTermCareParty } =
    calcHealthAndLongTermCarePartyShares(insuranceBase);

  const employmentUnemployment = calcEmploymentUnemploymentShare(insuranceBase);
  const employmentStability = truncateWon(
    insuranceBase * EMPLOYMENT_STABILITY_EMPLOYER
  );
  const employmentEmployer = employmentUnemployment + employmentStability;

  const industrialAccidentEmployer = truncateWon(
    (insuranceBase * INDUSTRIAL_ACCIDENT_TOTAL_PERMILLE) / 1000
  );

  const totalEmployerContributions =
    pensionEmployer +
    healthParty +
    longTermCareParty +
    employmentEmployer +
    industrialAccidentEmployer;

  return {
    pensionEmployer,
    healthEmployer: healthParty,
    longTermCareEmployer: longTermCareParty,
    employmentUnemployment,
    employmentStability,
    employmentEmployer,
    industrialAccidentEmployer,
    totalEmployerContributions,
  };
}

/** 한국 4대보험 사업주 부담 포함 월 인건비(급여+회사부담) */
export function calcEmployerCostFromMonthlyGross(
  monthlyGross: number,
  nonTaxableMonthly = 0
): EmployerInsuranceBreakdown {
  if (monthlyGross <= 0) return { ...ZERO_BREAKDOWN };

  const insuranceBase = Math.max(0, monthlyGross - nonTaxableMonthly);
  const contributions = calcEmployerContributionsFromInsuranceBase(insuranceBase);

  return {
    monthlyGross,
    nonTaxableMonthly,
    insuranceBase,
    ...contributions,
    totalMonthlyEmployerCost:
      monthlyGross + contributions.totalEmployerContributions,
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
