import type { TransactionType } from "./types";

export const REVENUE_CATEGORY_SUGGESTIONS = [
  "대행 수수료",
  "컨설팅",
  "리테이너",
  "프로젝트",
  "기타 매출",
];

export const EXPENSE_CATEGORY_SUGGESTIONS = [
  "인건비",
  "사무실임대료",
  "사무실 관리비",
  "복합기비용",
  "사무실비품",
  "통신비용",
  "정수기 비용",
  "사무실비용",
  "광고비",
  "SaaS 구독",
  "프리랜서",
  "해외 인건비",
  "메타 광고비",
  "구글 광고비",
  "기타 비용",
];

export function getCategorySuggestions(type: TransactionType): string[] {
  return type === "revenue"
    ? REVENUE_CATEGORY_SUGGESTIONS
    : EXPENSE_CATEGORY_SUGGESTIONS;
}
