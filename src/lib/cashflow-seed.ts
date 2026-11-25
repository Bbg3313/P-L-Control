import type { HospitalTemplate } from "@/lib/cashflow-types";

/**
 * 병원·월별 청구액 강제 (용역비 특약).
 * 키: hospitalId → yearMonth → amount
 */
export const HOSPITAL_MONTH_AMOUNT_OVERRIDES: Record<
  string,
  Record<string, number>
> = {
  // 강남서울안과: 11·12월분 11월에 일괄, 12월 0
  "h-gangnam-seoul-eye": {
    "2026-11": 8_250_000, // 4,125,000 × 2
    "2026-12": 0,
  },
};

export function resolveHospitalMonthAmount(
  hospitalId: string,
  yearMonth: string,
  defaultAmount: number,
  previousAmount?: number
): number {
  const forced = HOSPITAL_MONTH_AMOUNT_OVERRIDES[hospitalId]?.[yearMonth];
  if (forced !== undefined) return forced;
  if (previousAmount !== undefined && previousAmount > 0) return previousAmount;
  return defaultAmount;
}

/**
 * 병원 계약 현황 (부가세 포함) — 엑셀 목록 그대로
 * 미케이의원 2건 = 베트남 / 태국
 */
export const SEED_HOSPITALS: HospitalTemplate[] = [
  {
    id: "h-white-e",
    name: "화이트e치과",
    defaultAmount: 3_630_000,
    expectedDay: 1,
    contractStatus: "외주",
  },
  {
    id: "h-signature-hold",
    name: "시그니처성형외과",
    defaultAmount: 3_960_000,
    expectedDay: 2,
    contractStatus: "보류",
  },
  {
    id: "h-peachcell",
    name: "피치셀의원",
    defaultAmount: 5_500_000,
    expectedDay: 4,
    contractStatus: "보류",
  },
  {
    id: "h-recham",
    name: "리참성형외과",
    defaultAmount: 3_960_000,
    expectedDay: 7,
    contractStatus: "자체",
  },
  {
    id: "h-viewline",
    name: "뷰라인치과",
    defaultAmount: 4_125_000,
    expectedDay: 10,
    contractStatus: "외주",
  },
  {
    id: "h-apgujeong-eye",
    name: "압구정안과의원",
    defaultAmount: 4_125_000,
    expectedDay: 12,
    contractStatus: "외주",
  },
  {
    id: "h-eunpyeong",
    name: "은평더맑은의원",
    defaultAmount: 4_125_000,
    expectedDay: 15,
    contractStatus: "외주",
  },
  {
    id: "h-signature",
    name: "시그니처성형외과",
    defaultAmount: 6_600_000,
    expectedDay: 16,
    contractStatus: "외주",
  },
  {
    id: "h-renovo",
    name: "리노보의원 압구정",
    defaultAmount: 660_000,
    expectedDay: 17,
    contractStatus: "자체",
  },
  {
    id: "h-riyeon",
    name: "리연케이의원",
    defaultAmount: 4_125_000,
    expectedDay: 18,
    contractStatus: "외주",
  },
  {
    id: "h-bbliy",
    name: "쁠리성형외과",
    defaultAmount: 3_278_000,
    expectedDay: 19,
    contractStatus: "외주",
  },
  {
    id: "h-ilmiri",
    name: "일미리성형외과",
    defaultAmount: 4_400_000,
    expectedDay: 19,
    contractStatus: "자체",
  },
  {
    id: "h-innovell",
    name: "이노벨의원",
    defaultAmount: 11_000_000,
    expectedDay: 20,
    contractStatus: "외주",
  },
  {
    id: "h-jdriches",
    name: "제이디리체스",
    defaultAmount: 2_750_000,
    expectedDay: 22,
    contractStatus: "자체",
  },
  {
    id: "h-delphic",
    name: "델픽의원",
    defaultAmount: 3_080_000,
    expectedDay: 23,
    contractStatus: "자체",
  },
  {
    id: "h-thevivi",
    name: "더비비성형외과",
    defaultAmount: 3_080_000,
    expectedDay: 24,
    contractStatus: "자체",
  },
  {
    id: "h-harmony",
    name: "하모니성형외과",
    defaultAmount: 2_200_000,
    expectedDay: 26,
    contractStatus: "자체",
  },
  {
    id: "h-smiled",
    name: "스마일디치과",
    defaultAmount: 3_575_000,
    expectedDay: 27,
    contractStatus: "외주",
  },
  {
    id: "h-hize-cheongdam",
    name: "하이즈의원 청담",
    defaultAmount: 11_000_000,
    expectedDay: 28,
    contractStatus: "보류",
  },
  {
    id: "h-ruby",
    name: "루비성형외과",
    defaultAmount: 4_125_000,
    expectedDay: 28,
    contractStatus: "외주",
  },
  {
    id: "h-mikey-vn",
    name: "미케이의원 베트남",
    defaultAmount: 3_080_000,
    expectedDay: 29,
    contractStatus: "자체",
  },
  {
    id: "h-mikey-th",
    name: "미케이의원 태국",
    defaultAmount: 3_080_000,
    expectedDay: 29,
    contractStatus: "자체",
  },
  {
    id: "h-gangnam-seoul-eye",
    name: "강남서울안과의원",
    defaultAmount: 4_125_000,
    expectedDay: 29,
    contractStatus: "외주",
  },
  {
    id: "h-bgn",
    name: "BGN밝은눈안과",
    defaultAmount: 4_125_000,
    expectedDay: 29,
    contractStatus: "외주",
  },
  {
    id: "h-suenne",
    name: "수엔느의원",
    defaultAmount: 3_712_500,
    expectedDay: 29,
    contractStatus: "외주",
  },
  {
    id: "h-hize-atcenter",
    name: "하이즈의원 앳센터",
    defaultAmount: 5_445_000,
    expectedDay: 31,
    contractStatus: "보류",
  },
];
