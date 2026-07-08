/**
 * 2026.3.1~ 근로소득 간이세액표 (nodong.kr / 국세청 고시 기준)
 * - 구간: 천원, 세액: 원
 * - 입력: 비과세 제외 월급여(원), 부양가족 수(1~6, 본인만=1)
 */

import tableData from "@/data/simplified-tax-table-2026.json";

type TaxRow = [number, number, number, number, number, number, number, number];

const rows = tableData.rows as TaxRow[];

export function lookupSimplifiedWithholdingTax(
  monthlyTaxableWon: number,
  familyCount = 1
): number {
  if (monthlyTaxableWon <= 0) return 0;

  const col = Math.min(6, Math.max(1, familyCount)) - 1;
  const thousands = monthlyTaxableWon / 1000;

  for (const row of rows) {
    const [lower, upper, ...taxes] = row;
    if (thousands >= lower && thousands < upper) {
      return taxes[col] ?? 0;
    }
  }

  const last = rows[rows.length - 1];
  if (last && thousands >= last[0]) {
    return last[2 + col] ?? 0;
  }

  return 0;
}
