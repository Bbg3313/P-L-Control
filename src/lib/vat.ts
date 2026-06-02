import type { FinancialRecord } from "@/lib/types";

export const VAT_RATE = 0.1;

export interface RevenueAmountParts {
  /** 손익 집계용 매출액 */
  supply: number;
  /** 부가세 (포함 항목만) */
  vat: number;
  /** 부가세 포함 항목의 입력 합계 */
  gross: number;
}

export interface RevenueVatSummary {
  supplyTotal: number;
  vatTotal: number;
  grossTotal: number;
  /** 부가세 포함으로 표시된 건수 */
  vatIncludedCount: number;
}

function truncateWon(amount: number): number {
  return Math.floor(amount);
}

/**
 * 매출 금액 분리.
 * - 계산서 발행(부가세 포함): 입력 합계에서 10% 세액 역산
 * - 무자료(부가세 미포함): 입력 금액 그대로 매출, 세액 0
 */
export function splitRevenueAmount(
  amount: number,
  amountIncludesVat = false
): RevenueAmountParts {
  if (amount <= 0) {
    return { supply: 0, vat: 0, gross: 0 };
  }

  if (amountIncludesVat) {
    const supply = truncateWon(amount / (1 + VAT_RATE));
    const vat = amount - supply;
    return { supply, vat, gross: amount };
  }

  return { supply: amount, vat: 0, gross: amount };
}

export function recordIncludesVat(record: FinancialRecord): boolean {
  return record.type === "revenue" && record.amountIncludesVat === true;
}

/** 손익·대시보드 집계용 매출액 */
export function getRevenueSupplyAmount(record: FinancialRecord): number {
  if (record.type !== "revenue") return record.amount;
  return splitRevenueAmount(record.amount, record.amountIncludesVat === true)
    .supply;
}

/** 부가세 포함 항목만 세액 반환 */
export function getRevenueVatAmount(record: FinancialRecord): number {
  if (record.type !== "revenue" || !recordIncludesVat(record)) return 0;
  return splitRevenueAmount(record.amount, true).vat;
}

export function summarizeRevenueVat(
  records: FinancialRecord[],
  yearMonth?: string
): RevenueVatSummary {
  let supplyTotal = 0;
  let vatTotal = 0;
  let vatIncludedCount = 0;

  for (const record of records) {
    if (record.type !== "revenue") continue;
    if (yearMonth && record.date.slice(0, 7) !== yearMonth) continue;

    const includesVat = record.amountIncludesVat === true;
    const parts = splitRevenueAmount(record.amount, includesVat);
    supplyTotal += parts.supply;
    if (includesVat) {
      vatTotal += parts.vat;
      vatIncludedCount += 1;
    }
  }

  return {
    supplyTotal,
    vatTotal,
    grossTotal: supplyTotal + vatTotal,
    vatIncludedCount,
  };
}
