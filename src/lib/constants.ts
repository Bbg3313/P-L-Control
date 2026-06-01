/**
 * 운영 예비금 산정 — 월평균 운영비(인건비+기타비용) × 개월 수.
 * 중소기업·현금흐름 관리에서 흔히 쓰는 「운영자금 3개월분」 기준.
 */
export const OPERATING_RESERVE_MONTHS = 3;

/** 평균 운영비 산출 시 참고할 최근 개월 수 */
export const OPERATING_RESERVE_LOOKBACK_MONTHS = 3;

/** 대시보드 차트·누적 집계 시작 월 */
export const DASHBOARD_CHART_START_MONTH = "2026-05";

export const STORAGE_KEY = "pl-control-records-v2";

export const REPORTING_MONTH_STORAGE_KEY = "pl-control-reporting-month";

export { PERSONNEL_STORAGE_KEY } from "@/lib/personnel";
