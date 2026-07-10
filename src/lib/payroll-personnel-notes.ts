/** 급여대장 비고 — 인원별 기본 안내 (편집 전 표시) */
export const PAYROLL_DEFAULT_MEMO_BY_NAME: Record<string, string> = {
  성수린:
    "기본 475만+성과급별도·세금은 총지급 기준·보험은 과세급여 기준·연말 보수총액 정산",
  아리: "외국인·고용보험 미가입",
};

export function getDefaultPayrollMemo(name: string): string {
  return PAYROLL_DEFAULT_MEMO_BY_NAME[name] ?? "";
}

export function buildPayrollRowNote(
  systemNotes: string[],
  name: string,
  customMemo?: string
): string {
  const memo =
    customMemo !== undefined ? customMemo.trim() : getDefaultPayrollMemo(name);
  return [...systemNotes, memo].filter(Boolean).join(" · ");
}
