/** 급여대장 비고 — 인원별 기본 안내 (편집 전 표시) */
export const PAYROLL_DEFAULT_MEMO_BY_NAME: Record<string, string> = {
  성수린: "4대보험 (기본급여−비과세) / 원천세 과세표준",
  김소연: "4대보험 (기본급여−비과세) / 원천세 과세표준",
  니키: "4대보험 (기본급여−비과세) / 원천세 과세표준",
  정수민: "4대보험 (기본급여−비과세) / 원천세 과세표준",
  아리: "2026-07 퇴사",
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
