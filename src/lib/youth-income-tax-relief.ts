/**
 * 중소기업 취업자 소득세 감면 (조세특례제한법 제30조) — 청년
 * - 감면율: 소득세의 90%
 * - 한도: 과세기간(연) 200만 원
 * - 2012.1.1~2026.12.31 중소기업 취업 청년
 */

import {
  calcEmployeeInsuranceFromInsuranceBase,
  calcLocalIncomeTaxFromIncomeTax,
  calcMonthlyWithholdingTax,
} from "@/lib/income-tax-2026";

export const YOUTH_TAX_RELIEF_NAMES = ["박양근", "정수민"] as const;

const YOUTH_RELIEF_RATE = 0.9;
/** 과세기간별 감면세액 한도 */
const ANNUAL_RELIEF_CAP = 2_000_000;
/** 월별 안분 상한 (연간 한도 ÷ 12) */
const MONTHLY_RELIEF_CAP = Math.floor(ANNUAL_RELIEF_CAP / 12);

export function isYouthIncomeTaxReliefEligible(name: string): boolean {
  return (YOUTH_TAX_RELIEF_NAMES as readonly string[]).includes(name);
}

export interface YouthTaxReliefBreakdown {
  monthlyGross: number;
  nonTaxableMonthly: number;
  insuranceBase: number;
  employeeInsurance: number;
  incomeTaxBeforeRelief: number;
  incomeTaxRelief: number;
  incomeTaxAfterRelief: number;
  localIncomeTaxBeforeRelief: number;
  localIncomeTaxRelief: number;
  localIncomeTaxAfterRelief: number;
  /** 근로자 실수령 추정 (급여 − 본인4대보험 − 원천징수세) */
  estimatedNetPay: number;
}

export function calcYouthTaxReliefBreakdown(
  monthlyGross: number,
  nonTaxableMonthly = 0
): YouthTaxReliefBreakdown | null {
  if (monthlyGross <= 0) return null;

  const insuranceBase = Math.max(0, monthlyGross - nonTaxableMonthly);
  const employeeInsurance =
    calcEmployeeInsuranceFromInsuranceBase(insuranceBase);
  const incomeTaxBeforeRelief = calcMonthlyWithholdingTax(
    monthlyGross,
    nonTaxableMonthly
  );
  const localIncomeTaxBeforeRelief = calcLocalIncomeTaxFromIncomeTax(
    incomeTaxBeforeRelief
  );

  const incomeTaxRelief = Math.min(
    Math.floor(incomeTaxBeforeRelief * YOUTH_RELIEF_RATE),
    MONTHLY_RELIEF_CAP
  );
  const incomeTaxAfterRelief = Math.max(
    0,
    incomeTaxBeforeRelief - incomeTaxRelief
  );

  const localIncomeTaxAfterRelief =
    calcLocalIncomeTaxFromIncomeTax(incomeTaxAfterRelief);
  const localIncomeTaxRelief =
    localIncomeTaxBeforeRelief - localIncomeTaxAfterRelief;

  const estimatedNetPay =
    monthlyGross -
    employeeInsurance -
    incomeTaxAfterRelief -
    localIncomeTaxAfterRelief;

  return {
    monthlyGross,
    nonTaxableMonthly,
    insuranceBase,
    employeeInsurance,
    incomeTaxBeforeRelief,
    incomeTaxRelief,
    incomeTaxAfterRelief,
    localIncomeTaxBeforeRelief,
    localIncomeTaxRelief,
    localIncomeTaxAfterRelief,
    estimatedNetPay,
  };
}
