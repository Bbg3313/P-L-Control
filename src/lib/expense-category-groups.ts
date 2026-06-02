/** 집계·표시용 그룹명 */
export const OFFICE_MANAGEMENT_GROUP = "사무실관리비용";

/** 사무실관리비용으로 합산되는 항목 (공백 무시 매칭) */
const OFFICE_MANAGEMENT_SOURCE_KEYS = new Set([
  "사무실임대료",
  "사무실관리비",
  "복합기비용",
  "사무실비품",
  "통신비용",
  "정수기비용",
]);

function normalizeCategoryKey(label: string): string {
  return label.trim().replace(/\s+/g, "");
}

/** 비용 항목명 → 화면·집계용 카테고리 */
export function getExpenseDisplayCategory(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "기타 비용";

  if (OFFICE_MANAGEMENT_SOURCE_KEYS.has(normalizeCategoryKey(trimmed))) {
    return OFFICE_MANAGEMENT_GROUP;
  }

  return trimmed;
}

export function isOfficeManagementSourceCategory(label: string): boolean {
  return OFFICE_MANAGEMENT_SOURCE_KEYS.has(normalizeCategoryKey(label));
}

/** 입력용 사무실 세부 항목 (개별 등록 → 사무실관리비용으로 합산) */
export const OFFICE_MANAGEMENT_SOURCE_LABELS = [
  "사무실임대료",
  "사무실 관리비",
  "복합기비용",
  "사무실비품",
  "통신비용",
  "정수기 비용",
] as const;
