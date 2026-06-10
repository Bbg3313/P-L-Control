/** 근로기준법 제60조(연차유급휴가) 기준 발생일수 계산 */

export interface AnnualLeaveEntitlement {
  /** 현재 시점 발생 연차(일) */
  days: number;
  /** 1년 미만 월별 / 1년 이상 연간 */
  phase: "monthly" | "annual";
  /** 근속 개월 수 */
  tenureMonths: number;
  /** 근속 연수(만) */
  tenureYears: number;
  /** 연차 소진 기한 (YYYY-MM-DD) — 1년 미만: 입사 1주년 전날, 1년 이상: 입사기념일 전날 */
  useByDate: string | null;
  /** 안내 문구 */
  ruleLabel: string;
}

function parseLocalDate(value: string): Date | null {
  const [y, m, d] = value.split("-").map((part) => Number.parseInt(part, 10));
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

function formatDateYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 연차 소진 기한 (입사일 기준)
 * - 1년 미만: 입사 1주년 전날까지
 * - 1년 이상: 다음 입사기념일 전날까지
 */
export function calcLeaveUseByDate(
  hireDate: string,
  asOf: Date = new Date()
): string | null {
  const start = parseLocalDate(hireDate);
  if (!start || asOf < start) return null;

  const tenureMonths = calcTenureMonths(start, asOf);

  if (tenureMonths < 12) {
    const firstAnniversary = new Date(
      start.getFullYear() + 1,
      start.getMonth(),
      start.getDate()
    );
    const expiry = new Date(firstAnniversary);
    expiry.setDate(expiry.getDate() - 1);
    return formatDateYmd(expiry);
  }

  const tenureYears = calcTenureYears(start, asOf);
  let anniversaryYear = start.getFullYear() + tenureYears;
  let anniversary = new Date(
    anniversaryYear,
    start.getMonth(),
    start.getDate()
  );

  if (asOf < anniversary) {
    anniversaryYear -= 1;
    anniversary = new Date(
      anniversaryYear,
      start.getMonth(),
      start.getDate()
    );
  }

  const nextAnniversary = new Date(
    anniversaryYear + 1,
    start.getMonth(),
    start.getDate()
  );
  const expiry = new Date(nextAnniversary);
  expiry.setDate(expiry.getDate() - 1);

  return formatDateYmd(expiry);
}

export function calcTenureMonths(start: Date, end: Date): number {
  if (end < start) return 0;
  let months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

export function calcTenureYears(start: Date, end: Date): number {
  let years = end.getFullYear() - start.getFullYear();
  const monthDiff = end.getMonth() - start.getMonth();
  const dayDiff = end.getDate() - start.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) years -= 1;
  return Math.max(0, years);
}

/** 1년 이상 근로자 연간 발생일 (출근율 80% 이상 가정) */
export function annualLeaveDaysAfterOneYear(tenureYears: number): number {
  if (tenureYears < 1) return 0;
  const bonus = Math.floor(Math.max(0, tenureYears - 1) / 2);
  return Math.min(25, 15 + bonus);
}

/**
 * 근로기준법 제60조 기준 연차 발생일
 * - 1년 미만: 개근 월 1일 (최대 11일)
 * - 1년 이상: 15일 + 2년마다 1일 (최대 25일)
 */
export function calcStatutoryAnnualLeave(
  hireDate: string,
  asOf: Date = new Date()
): AnnualLeaveEntitlement | null {
  const start = parseLocalDate(hireDate);
  if (!start || asOf < start) return null;

  const tenureMonths = calcTenureMonths(start, asOf);
  const tenureYears = calcTenureYears(start, asOf);

  const useByDate = calcLeaveUseByDate(hireDate, asOf);

  if (tenureMonths < 12) {
    const days = Math.min(11, tenureMonths);
    return {
      days,
      phase: "monthly",
      tenureMonths,
      tenureYears,
      useByDate,
      ruleLabel: "1년 미만 · 출근율 80% 이상 월 1일 (최대 11일)",
    };
  }

  const days = annualLeaveDaysAfterOneYear(tenureYears);
  return {
    days,
    phase: "annual",
    tenureMonths,
    tenureYears,
    useByDate,
    ruleLabel:
      tenureYears >= 3
        ? `1년 이상 15일 + 2년마다 1일 (현재 ${days}일, 최대 25일)`
        : "1년 이상 · 출근율 80% 이상 시 15일",
  };
}

