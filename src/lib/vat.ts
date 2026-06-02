import type { FinancialRecord } from "@/lib/types";

export const VAT_RATE = 0.1;

export interface RevenueAmountParts {
  /** 공급가액 (부가세 제외) */
  supply: number;
  /** 부가세 */
  vat: number;
  /** 합계 (공급가 + 부가세) */
  gross: number;
}

export interface RevenueVatSummary {
  supplyTotal: number;
  vatTotal: number;
  grossTotal: number;
}

function truncateWon(amount: number): number {
  return Math.floor(amount);
}

/** 입력 금액을 공급가·부가세·합계로 분리 (부가세 10%) */
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

  const supply = amount;
  const vat = truncateWon(supply * VAT_RATE);
  return { supply, vat, gross: supply + vat };
}

export function recordIncludesVat(record: FinancialRecord): boolean {
  return record.type === "revenue" && (record.amountIncludesVat ?? false);
}

/** 손익·대시보드 집계용 공급가액 */
export function getRevenueSupplyAmount(record: FinancialRecord): number {
  if (record.type !== "revenue") return record.amount;
  return splitRevenueAmount(
    record.amount,
    record.amountIncludesVat ?? false
  ).supply;
}

export function getRevenueVatAmount(record: FinancialRecord): number {
  if (record.type !== "revenue") return 0;
  return splitRevenueAmount(
    record.amount,
    record.amountIncludesVat ?? false
  ).vat;
}

export function summarizeRevenueVat(
  records: FinancialRecord[],
  yearMonth?: string
): RevenueVatSummary {
  let supplyTotal = 0;
  let vatTotal = 0;
  let grossTotal = 0;

  for (const record of records) {
    if (record.type !== "revenue") continue;
    if (yearMonth && record.date.slice(0, 7) !== yearMonth) continue;

    const parts = splitRevenueAmount(
      record.amount,
      record.amountIncludesVat ?? false
    );
    supplyTotal += parts.supply;
    vatTotal += parts.vat;
    grossTotal += parts.gross;
  }

  return { supplyTotal, vatTotal, grossTotal };
}
