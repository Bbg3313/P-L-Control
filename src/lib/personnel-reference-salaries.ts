import type { PersonnelEntry } from "@/lib/personnel";

export type PersonnelReferenceSalary =
  | { mode: "salary"; annual: number }
  | { mode: "direct"; monthly: number };

/** 고정 인건비 — 국내 연봉·현지팀 월 원화 */
export const PERSONNEL_REFERENCE_SALARIES: Record<
  string,
  PersonnelReferenceSalary
> = {
  성수린: { mode: "salary", annual: 57_000_000 },
  박양근: { mode: "salary", annual: 51_600_000 },
  안효재: { mode: "salary", annual: 34_000_000 },
  니키: { mode: "salary", annual: 35_000_000 },
  아리: { mode: "salary", annual: 30_000_000 },
  김소연: { mode: "salary", annual: 40_000_000 },
  정수민: { mode: "salary", annual: 27_000_000 },
  태국현지팀: { mode: "direct", monthly: 4_000_000 },
  베트남현지팀: { mode: "direct", monthly: 1_000_000 },
};

export function applyPersonnelReferenceSalary(
  name: string,
  entry: PersonnelEntry
): PersonnelEntry {
  const ref = PERSONNEL_REFERENCE_SALARIES[name];
  if (!ref) return entry;

  if (ref.mode === "salary") {
    return {
      ...entry,
      inputMode: "salary",
      salaryAmount: ref.annual,
      salaryBasis: "annual",
      directMonthlyAmount: 0,
    };
  }

  return {
    ...entry,
    inputMode: "direct",
    directMonthlyAmount: ref.monthly,
    salaryAmount: 0,
    salaryBasis: "monthly",
  };
}
