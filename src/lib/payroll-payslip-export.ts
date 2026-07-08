import * as XLSX from "xlsx";
import type { PayrollLedgerResult, PayrollLedgerRow } from "@/lib/payroll-ledger";
import { JUN_2026_INSURANCE_LABEL } from "@/lib/social-insurance-jun-2026";

const MONEY_FMT = "#,##0";
const COLS = 4;

function periodLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return `${year}년 ${Number(month)}월`;
}

function applyMoneyFormat(ws: XLSX.WorkSheet, row: number, col: number): void {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = ws[addr];
  if (cell && cell.t === "n") {
    cell.z = MONEY_FMT;
  }
}

interface PayslipSheet {
  rows: (string | number)[][];
  netPayRow: number;
  noteRow: number | null;
  footerRow: number;
  moneyRows: number[];
}

function buildPayslipSheet(
  ledger: PayrollLedgerResult,
  row: PayrollLedgerRow,
  sequenceNo: number
): PayslipSheet {
  const period = periodLabel(ledger.yearMonth);
  const payLines: [string, number][] = [
    ["기본급", row.monthlyGross],
    ["비과세(식대 등)", row.nonTaxable],
    ["과세표준", row.taxableBase],
  ];
  const deductLines: [string, number][] = [
    ["국민연금", row.employeePension],
    ["건강보험", row.employeeHealth],
    ["장기요양보험", row.employeeLongTermCare],
    ["고용보험", row.employeeEmployment],
    ["소득세", row.incomeTax],
    ["지방소득세", row.localIncomeTax],
  ];

  const sheet: (string | number)[][] = [
    [ledger.companyLabel],
    ["급여명세서"],
    [`${period}분`, "", "", "(단위: 원)"],
    [],
    ["성명", row.name, "구분번호", sequenceNo],
    ["소속", row.department || "—", "귀속월", `${period}분`],
    [],
    ["지급 항목", "금액", "공제 항목", "금액"],
  ];

  const bodyRows = Math.max(payLines.length, deductLines.length);
  const moneyRows: number[] = [];

  for (let i = 0; i < bodyRows; i += 1) {
    const pay = payLines[i];
    const deduct = deductLines[i];
    sheet.push([
      pay?.[0] ?? "",
      pay?.[1] ?? "",
      deduct?.[0] ?? "",
      deduct?.[1] ?? "",
    ]);
    moneyRows.push(sheet.length - 1);
  }

  sheet.push(["지급합계", row.monthlyGross, "공제합계", row.totalDeductions]);
  moneyRows.push(sheet.length - 1);

  sheet.push([]);
  sheet.push(["실지급액", "", "", row.netPay]);
  const netPayRow = sheet.length - 1;
  moneyRows.push(netPayRow);

  let noteRow: number | null = null;
  if (row.note) {
    sheet.push([], [`※ ${row.note}`]);
    noteRow = sheet.length - 1;
  }

  sheet.push([], [JUN_2026_INSURANCE_LABEL]);
  const footerRow = sheet.length - 1;

  return { rows: sheet, netPayRow, noteRow, footerRow, moneyRows };
}

export function downloadPayrollPayslipExcel(
  ledger: PayrollLedgerResult,
  row: PayrollLedgerRow,
  sequenceNo: number
): void {
  const { rows, netPayRow, noteRow, footerRow, moneyRows } = buildPayslipSheet(
    ledger,
    row,
    sequenceNo
  );
  const ws = XLSX.utils.aoa_to_sheet(rows);

  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: COLS - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
    { s: { r: netPayRow, c: 0 }, e: { r: netPayRow, c: 2 } },
    { s: { r: footerRow, c: 0 }, e: { r: footerRow, c: COLS - 1 } },
  ];

  if (noteRow !== null) {
    merges.push({ s: { r: noteRow, c: 0 }, e: { r: noteRow, c: COLS - 1 } });
  }

  ws["!merges"] = merges;

  for (const r of moneyRows) {
    applyMoneyFormat(ws, r, 1);
    applyMoneyFormat(ws, r, 3);
  }

  ws["!cols"] = [{ wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "급여명세서");
  XLSX.writeFile(wb, `급여명세서_${row.name}_${ledger.yearMonth}.xlsx`);
}
