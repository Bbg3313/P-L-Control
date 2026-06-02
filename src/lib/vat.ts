import type { FinancialRecord, TransactionType } from "@/lib/types";

export const VAT_RATE = 0.1;

export interface VatAmountParts {
  /** 손익 집계용 금액 */
  supply: number;
  /** 세액 (계산서 항목만) */
  vat: number;
  /** 계산서 항목 입력 합계 */
  gross: number;
}

/** @deprecated VatAmountParts 와 동일 */
export type RevenueAmountParts = VatAmountParts;

export interface VatSummary {
  supplyTotal: number;
  vatTotal: number;
  grossTotal: number;
  vatIncludedCount: number;
}

/** @deprecated VatSummary 와 동일 */
export type RevenueVatSummary = VatSummary;

export interface VatSettlement {
  /** 매출세액 (블루브릿지 계산서 발행) */
  outputVat: number;
  /** 매입세액 (골드펜더 등 계산서 수취) */
  inputVat: number;
  /** 납부세액 max(0, 매출−매입) */
  vatPayable: number;
  /** 환급세액 max(0, 매입−매출) */
  vatRefund: number;
}

function truncateWon(amount: number): number {
  return Math.floor(amount);
}

/**
 * 금액 분리.
 * - 계산서: 입력 합계에서 10% 세액 역산
 * - 무자료: 입력 금액 그대로, 세액 0
 */
export function splitVatAmount(
  amount: number,
  amountIncludesVat = false
): VatAmountParts {
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

export const splitRevenueAmount = splitVatAmount;

/** 저장·API 호환 — 계산서(부가세 포함) 여부 */
export function isTaxInvoice(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

export function recordHasTaxInvoice(record: FinancialRecord): boolean {
  return isTaxInvoice(record.amountIncludesVat);
}

function getSupplyAmount(record: FinancialRecord): number {
  return splitVatAmount(record.amount, recordHasTaxInvoice(record)).supply;
}

/** 손익·대시보드 집계용 매출액 */
export function getRevenueSupplyAmount(record: FinancialRecord): number {
  if (record.type !== "revenue") return record.amount;
  return getSupplyAmount(record);
}

/** 손익·대시보드 집계용 비용(기타) */
export function getExpenseSupplyAmount(record: FinancialRecord): number {
  if (record.type !== "expense") return record.amount;
  return getSupplyAmount(record);
}

export function getRevenueVatAmount(record: FinancialRecord): number {
  if (record.type !== "revenue" || !recordHasTaxInvoice(record)) return 0;
  return splitVatAmount(record.amount, true).vat;
}

export function getExpenseVatAmount(record: FinancialRecord): number {
  if (record.type !== "expense" || !recordHasTaxInvoice(record)) return 0;
  return splitVatAmount(record.amount, true).vat;
}

function summarizeVatByType(
  records: FinancialRecord[],
  type: TransactionType,
  yearMonth?: string
): VatSummary {
  let supplyTotal = 0;
  let vatTotal = 0;
  let vatIncludedCount = 0;

  for (const record of records) {
    if (record.type !== type) continue;
    if (yearMonth && record.date.slice(0, 7) !== yearMonth) continue;

    const includesVat = recordHasTaxInvoice(record);
    const parts = splitVatAmount(record.amount, includesVat);
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

export function summarizeRevenueVat(
  records: FinancialRecord[],
  yearMonth?: string
): VatSummary {
  return summarizeVatByType(records, "revenue", yearMonth);
}

export function summarizeExpenseVat(
  records: FinancialRecord[],
  yearMonth?: string
): VatSummary {
  return summarizeVatByType(records, "expense", yearMonth);
}

export function summarizeVatSettlement(
  records: FinancialRecord[],
  yearMonth: string
): VatSettlement {
  const outputVat = summarizeRevenueVat(records, yearMonth).vatTotal;
  const inputVat = summarizeExpenseVat(records, yearMonth).vatTotal;
  const net = outputVat - inputVat;

  return {
    outputVat,
    inputVat,
    vatPayable: Math.max(0, net),
    vatRefund: Math.max(0, -net),
  };
}
