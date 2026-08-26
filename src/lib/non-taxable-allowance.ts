/** 기본 월 비과세 (20만원) */
export const MONTHLY_NON_TAXABLE_ALLOWANCE = 200_000;

/** 월 비과세 40만원 */
export const MONTHLY_NON_TAXABLE_ALLOWANCE_40 = 400_000;

/** 국내 직원 — 보수·과세 산정 시 비과세 제외 */
const NON_TAXABLE_BY_NAME: Record<string, number> = {
  성수린: MONTHLY_NON_TAXABLE_ALLOWANCE,
  박양근: MONTHLY_NON_TAXABLE_ALLOWANCE_40,
  안효재: MONTHLY_NON_TAXABLE_ALLOWANCE_40,
  정수민: MONTHLY_NON_TAXABLE_ALLOWANCE,
  아리: MONTHLY_NON_TAXABLE_ALLOWANCE,
  니키: MONTHLY_NON_TAXABLE_ALLOWANCE,
  김소연: MONTHLY_NON_TAXABLE_ALLOWANCE,
  김영창: MONTHLY_NON_TAXABLE_ALLOWANCE,
  서미희: MONTHLY_NON_TAXABLE_ALLOWANCE,
  이정석: MONTHLY_NON_TAXABLE_ALLOWANCE,
};

export const NON_TAXABLE_ALLOWANCE_NAMES = Object.keys(
  NON_TAXABLE_BY_NAME
) as (keyof typeof NON_TAXABLE_BY_NAME)[];

export function getMonthlyNonTaxableAllowance(name: string): number {
  return NON_TAXABLE_BY_NAME[name] ?? 0;
}

/** 4대보험·원천징수 과세 보수월액 */
export function getInsuranceAndTaxBase(
  monthlyGross: number,
  nonTaxableMonthly: number
): number {
  return Math.max(0, monthlyGross - nonTaxableMonthly);
}
