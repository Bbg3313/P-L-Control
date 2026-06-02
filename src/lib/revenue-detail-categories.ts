import type { FinancialRecord } from "@/lib/types";

export const REVENUE_DETAIL_CATEGORIES = [
  "화장품",
  "병원",
  "기타",
  "한약",
] as const;

export type RevenueDetailCategory = (typeof REVENUE_DETAIL_CATEGORIES)[number];

const CATEGORY_SET = new Set<string>(REVENUE_DETAIL_CATEGORIES);

export function isRevenueDetailCategory(
  value: string
): value is RevenueDetailCategory {
  return CATEGORY_SET.has(value);
}

/** 매출 상세 카테고리 — 미지정·레거시는 기타 */
export function normalizeRevenueDetailCategory(value: unknown): RevenueDetailCategory {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (isRevenueDetailCategory(trimmed)) return trimmed;
  return "기타";
}

export function getRevenueDetailCategoryLabel(
  record: FinancialRecord
): RevenueDetailCategory {
  if (record.type !== "revenue") return "기타";

  const detail = record.detailCategory?.trim();
  if (detail && isRevenueDetailCategory(detail)) return detail;

  const legacyCategory = record.category.trim();
  if (isRevenueDetailCategory(legacyCategory)) return legacyCategory;

  return "기타";
}
