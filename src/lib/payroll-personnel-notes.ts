/** 급여대장 비고 — 인원별 기본 안내 (편집 전 표시) */
export const PAYROLL_DEFAULT_MEMO_BY_NAME: Record<string, string> = {
  성수린: "4대보험 (기본급여−비과세) / 원천세 과세표준",
  김소연: "4대보험 (기본급여−비과세) / 원천세 과세표준",
  니키: "4대보험 (기본급여−비과세) / 원천세 과세표준",
  정수민: "4대보험 (기본급여−비과세) / 원천세 과세표준",
  아리: "2026-07 퇴사",
};

/** 예전에 쓰던 기본 비고 — 저장된 값이면 새 기본 문구로 교체 */
const LEGACY_DEFAULT_MEMOS = [
  "4대보험 기본급여/원천세 과세표준",
  "4대보험·원천세 산정 기준 분리",
  "4대보험·원천세 산정 기준 분리(보수월액 칸)",
] as const;

export function getDefaultPayrollMemo(name: string): string {
  return PAYROLL_DEFAULT_MEMO_BY_NAME[name] ?? "";
}

/**
 * 저장된 비고가 옛 기본 문구면 undefined → 새 기본 비고 사용.
 * 커스텀+옛문구 혼합이면 옛문구만 새 기본으로 교체한 문자열 반환.
 */
export function normalizePayrollNoteOverride(
  name: string,
  override: string | undefined
): string | undefined {
  if (override === undefined) return undefined;
  const trimmed = override.trim();
  if (!trimmed) return undefined;

  const defaultMemo = getDefaultPayrollMemo(name);
  const legacySet = new Set<string>([
    ...(LEGACY_DEFAULT_MEMOS as readonly string[]),
    ...(defaultMemo ? [defaultMemo] : []),
  ]);

  // 통째로 옛/현 기본 문구만 있으면 → 기본 경로 사용
  if (legacySet.has(trimmed)) return undefined;

  const parts = trimmed.split(" · ").map((p) => p.trim()).filter(Boolean);
  const hadLegacyOnlyDefault = parts.some((p) =>
    (LEGACY_DEFAULT_MEMOS as readonly string[]).includes(p)
  );
  const customParts = parts.filter(
    (p) => !(LEGACY_DEFAULT_MEMOS as readonly string[]).includes(p)
  );

  if (hadLegacyOnlyDefault) {
    if (customParts.length === 0) return undefined;
    if (defaultMemo && !customParts.includes(defaultMemo)) {
      return [...customParts, defaultMemo].join(" · ");
    }
    return customParts.join(" · ");
  }

  return trimmed;
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
