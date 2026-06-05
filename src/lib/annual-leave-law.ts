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
  /** 안내 문구 */
  ruleLabel: string;
}

export interface AnnualLeaveTimelinePoint {
  /** 입사 후 N개월 */
  monthIndex: number;
  label: string;
  /** 해당 시점 누적·발생 연차 */
  days: number;
  phase: "monthly" | "annual";
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

function addMonths(base: Date, months: number): Date {
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return next;
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

  if (tenureMonths < 12) {
    const days = Math.min(11, tenureMonths);
    return {
      days,
      phase: "monthly",
      tenureMonths,
      tenureYears,
      ruleLabel: "1년 미만 · 출근율 80% 이상 월 1일 (최대 11일)",
    };
  }

  const days = annualLeaveDaysAfterOneYear(tenureYears);
  return {
    days,
    phase: "annual",
    tenureMonths,
    tenureYears,
    ruleLabel:
      tenureYears >= 3
        ? `1년 이상 15일 + 2년마다 1일 (현재 ${days}일, 최대 25일)`
        : "1년 이상 · 출근율 80% 이상 시 15일",
  };
}

/** 입사 후 월별 연차 발생 추이 (그래프용) */
export function buildAnnualLeaveTimeline(
  hireDate: string,
  spanMonths = 36
): AnnualLeaveTimelinePoint[] {
  const start = parseLocalDate(hireDate);
  if (!start) return [];

  const points: AnnualLeaveTimelinePoint[] = [];
  for (let m = 1; m <= spanMonths; m += 1) {
    const asOf = addMonths(start, m);
    const ent = calcStatutoryAnnualLeave(hireDate, asOf);
    if (!ent) continue;
    points.push({
      monthIndex: m,
      label:
        m < 12 ? `${m}개월` : m === 12 ? "1년" : `${Math.floor(m / 12)}년`,
      days: ent.days,
      phase: ent.phase,
    });
  }
  return points;
}

/** 근속 연수별 법정 연차 표 (교육용) */
export function buildLawReferenceSeries(): {
  years: number;
  days: number;
  label: string;
}[] {
  return Array.from({ length: 11 }, (_, i) => {
    const years = i + 1;
    return {
      years,
      days: annualLeaveDaysAfterOneYear(years),
      label: `${years}년`,
    };
  });
}
