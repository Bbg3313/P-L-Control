import * as XLSX from "xlsx";
import type { PayrollLedgerResult, PayrollLedgerRow } from "@/lib/payroll-ledger";
import { JUN_2026_INSURANCE_LABEL } from "@/lib/social-insurance-jun-2026";

/** 급여대장 본문 컬럼 (A=구분, B=성명, C~ 차인지급액) */
const HEADERS = [
  "구분",
  "성명",
  "지급총액",
  "비과세",
  "과세표준",
  "국민연금",
  "건강보험",
  "장기요양",
  "고용보험",
  "소득세",
  "지방소득세",
  "공제합계",
  "차인지급액",
  "비고",
] as const;

const MONEY_FMT = "#,##0";
/** 금액 컬럼 인덱스 (0-based): 지급총액 ~ 차인지급액 */
const MONEY_COL_INDEXES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function rowToCells(index: number, row: PayrollLedgerRow): (string | number)[] {
  const note =
    row.youthReliefEligible && row.incomeTaxRelief > 0
      ? "청년소득세감면"
      : row.taxableBaseOverridden
        ? "과세표준조정"
        : "";

  return [
    index,
    row.name,
    row.monthlyGross,
    row.nonTaxable,
    row.taxableBase,
    row.employeePension,
    row.employeeHealth,
    row.employeeLongTermCare,
    row.employeeEmployment,
    row.incomeTax,
    row.localIncomeTax,
    row.totalDeductions,
    row.netPay,
    note,
  ];
}

function summaryCells(ledger: PayrollLedgerResult): (string | number)[] {
  const rows = ledger.domestic;
  const sum = (pick: (r: PayrollLedgerRow) => number) =>
    rows.reduce((acc, r) => acc + pick(r), 0);
  const s = ledger.summary;

  return [
    "",
    "합계",
    s.grossTotal,
    s.nonTaxableTotal,
    s.taxableBaseTotal,
    sum((r) => r.employeePension),
    sum((r) => r.employeeHealth),
    sum((r) => r.employeeLongTermCare),
    sum((r) => r.employeeEmployment),
    s.incomeTaxTotal,
    s.localIncomeTaxTotal,
    s.totalDeductions,
    s.netPayTotal,
    "",
  ];
}

function applyMoneyFormats(
  ws: XLSX.WorkSheet,
  startRow: number,
  endRow: number
): void {
  for (let r = startRow; r <= endRow; r++) {
    for (const c of MONEY_COL_INDEXES) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell && cell.t === "n") {
        cell.z = MONEY_FMT;
      }
    }
  }
}

export function downloadPayrollLedgerExcel(ledger: PayrollLedgerResult): void {
  const [year, month] = ledger.yearMonth.split("-");
  const periodLabel = `${year}년 ${Number(month)}월`;
  const headerRowIndex = 3;
  const dataStartRow = headerRowIndex + 1;
  const dataEndRow = dataStartRow + ledger.domestic.length;

  const sheetData: (string | number)[][] = [
    [`${ledger.companyLabel}  ${periodLabel}  급여대장`],
    [`${JUN_2026_INSURANCE_LABEL}  ·  단위: 원`],
    [],
    [...HEADERS],
    ...ledger.domestic.map((row, i) => rowToCells(i + 1, row)),
    summaryCells(ledger),
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: HEADERS.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: HEADERS.length - 1 } },
  ];

  applyMoneyFormats(ws, dataStartRow, dataEndRow + 1);

  ws["!cols"] = [
    { wch: 5 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
  ];

  ws["!views"] = [
    {
      state: "frozen",
      xSplit: 0,
      ySplit: headerRowIndex + 1,
      topLeftCell: XLSX.utils.encode_cell({ r: dataStartRow, c: 0 }),
      activeCell: XLSX.utils.encode_cell({ r: dataStartRow, c: 0 }),
    },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "급여대장");
  XLSX.writeFile(
    wb,
    `급여대장_${ledger.companyLabel}_${ledger.yearMonth}.xlsx`
  );
}
