import * as XLSX from "xlsx-js-style";
import type { PayrollLedgerResult, PayrollLedgerRow } from "@/lib/payroll-ledger";
import { JUN_2026_INSURANCE_LABEL } from "@/lib/social-insurance-jun-2026";
import { formatNumber } from "@/lib/format";
import { formatPersonnelDisplayName } from "@/lib/personnel";

const LEADING_HEADERS = [
  "구분",
  "성명",
  "과세급여",
  "비과세",
  "총지급액",
  "과세표준",
] as const;

const DEDUCTION_HEADERS = ["국민", "건강", "장기", "고용"] as const;

const TRAILING_HEADERS = [
  "소득세",
  "지방소득세",
  "공제합계",
  "차인지급액",
  "비고",
] as const;

const HEADERS = [
  ...LEADING_HEADERS,
  ...DEDUCTION_HEADERS,
  ...TRAILING_HEADERS,
] as const;

const COL_COUNT = HEADERS.length;
const MONEY_FMT = "#,##0";
const MONEY_COL_INDEXES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const NET_PAY_COL = 13;

const COLORS = {
  titleBg: "EEF2FF",
  titleText: "1E293B",
  subtitleText: "64748B",
  headerBg: "334155",
  headerText: "FFFFFF",
  border: "CBD5E1",
  borderLight: "E2E8F0",
  rowAlt: "F8FAFC",
  summaryBg: "F1F5F9",
  netPayText: "1D4ED8",
};

type CellStyle = XLSX.CellStyle;

const THIN_BORDER = {
  top: { style: "thin" as const, color: { rgb: COLORS.border } },
  bottom: { style: "thin" as const, color: { rgb: COLORS.border } },
  left: { style: "thin" as const, color: { rgb: COLORS.border } },
  right: { style: "thin" as const, color: { rgb: COLORS.border } },
};

function baseFont(size = 11, bold = false, color = COLORS.titleText): CellStyle["font"] {
  return {
    name: "맑은 고딕",
    sz: size,
    bold,
    color: { rgb: color },
  };
}

function setCell(
  ws: XLSX.WorkSheet,
  row: number,
  col: number,
  value: string | number,
  style?: CellStyle
): void {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const isNumber = typeof value === "number";
  ws[addr] = {
    v: value,
    t: isNumber ? "n" : "s",
    ...(isNumber ? { z: MONEY_FMT } : {}),
    ...(style ? { s: style } : {}),
  };
}

function mergeRow(ws: XLSX.WorkSheet, row: number, fromCol: number, toCol: number): void {
  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({
    s: { r: row, c: fromCol },
    e: { r: row, c: toCol },
  });
}

function mergeCol(ws: XLSX.WorkSheet, col: number, fromRow: number, toRow: number): void {
  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({
    s: { r: fromRow, c: col },
    e: { r: toRow, c: col },
  });
}

function rowToCells(index: number, row: PayrollLedgerRow): (string | number)[] {
  const note =
    row.youthReliefEligible && row.incomeTaxRelief > 0
      ? "청년소득세감면"
      : row.taxableBaseOverridden
        ? "과세표준조정"
        : "";

  return [
    index,
    formatPersonnelDisplayName(row.name),
    row.defaultTaxableBase,
    row.nonTaxable,
    row.monthlyGross,
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
    s.basicPayTotal,
    s.nonTaxableTotal,
    s.grossTotal,
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

function bodyCellStyle(
  col: number,
  options?: { alt?: boolean; summary?: boolean; netPay?: boolean }
): CellStyle {
  const isMoney = MONEY_COL_INDEXES.includes(col);
  const isCenter = col === 0 || col === 1 || col === COL_COUNT - 1;

  let bg = "FFFFFF";
  if (options?.summary) bg = COLORS.summaryBg;
  else if (options?.alt) bg = COLORS.rowAlt;

  let color = COLORS.titleText;
  if (options?.netPay) color = COLORS.netPayText;

  return {
    font: baseFont(11, options?.summary || options?.netPay, color),
    fill: { fgColor: { rgb: bg } },
    alignment: {
      horizontal: isCenter ? "center" : isMoney ? "right" : "left",
      vertical: "center",
    },
    border: THIN_BORDER,
  };
}

function headerCellStyle(): CellStyle {
  return {
    font: baseFont(10, true, COLORS.headerText),
    fill: { fgColor: { rgb: COLORS.headerBg } },
    alignment: {
      horizontal: "center",
      vertical: "center",
      wrapText: true,
    },
    border: THIN_BORDER,
  };
}

function buildStyledSheet(ledger: PayrollLedgerResult): XLSX.WorkSheet {
  const [year, month] = ledger.yearMonth.split("-");
  const periodLabel = `${year}년 ${Number(month)}월`;
  const { summary } = ledger;

  const TITLE_ROW = 0;
  const SUBTITLE_ROW = 1;
  const KPI_ROW = 2;
  const HEADER_ROW = 4;
  const HEADER_ROW_2 = HEADER_ROW + 1;
  const DATA_START_ROW = HEADER_ROW_2 + 1;
  const dataRows = ledger.domestic.map((row, i) => rowToCells(i + 1, row));
  const SUMMARY_ROW = DATA_START_ROW + dataRows.length;

  const ws: XLSX.WorkSheet = {};
  const range = {
    s: { r: 0, c: 0 },
    e: { r: SUMMARY_ROW, c: COL_COUNT - 1 },
  };
  ws["!ref"] = XLSX.utils.encode_range(range);

  const title = `${ledger.companyLabel}  ${periodLabel}  급여대장`;
  setCell(ws, TITLE_ROW, 0, title, {
    font: baseFont(16, true, COLORS.titleText),
    fill: { fgColor: { rgb: COLORS.titleBg } },
    alignment: { horizontal: "center", vertical: "center" },
  });
  mergeRow(ws, TITLE_ROW, 0, COL_COUNT - 1);

  const subtitle = `${JUN_2026_INSURANCE_LABEL}  ·  단위: 원  ·  ${ledger.domestic.length}명`;
  setCell(ws, SUBTITLE_ROW, 0, subtitle, {
    font: baseFont(10, false, COLORS.subtitleText),
    fill: { fgColor: { rgb: COLORS.titleBg } },
    alignment: { horizontal: "center", vertical: "center" },
  });
  mergeRow(ws, SUBTITLE_ROW, 0, COL_COUNT - 1);

  const kpiText = `총지급액 ${formatNumber(summary.grossTotal)}원  |  실지급 ${formatNumber(summary.netPayTotal)}원  |  공제합계 ${formatNumber(summary.totalDeductions)}원  |  원천징수 ${formatNumber(summary.incomeTaxTotal + summary.localIncomeTaxTotal)}원`;
  setCell(ws, KPI_ROW, 0, kpiText, {
    font: baseFont(10, true, COLORS.titleText),
    fill: { fgColor: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
  });
  mergeRow(ws, KPI_ROW, 0, COL_COUNT - 1);

  LEADING_HEADERS.forEach((label, index) => {
    setCell(ws, HEADER_ROW, index, label, headerCellStyle());
    mergeCol(ws, index, HEADER_ROW, HEADER_ROW_2);
  });

  setCell(ws, HEADER_ROW, LEADING_HEADERS.length, "공제내역", headerCellStyle());
  mergeRow(
    ws,
    HEADER_ROW,
    LEADING_HEADERS.length,
    LEADING_HEADERS.length + DEDUCTION_HEADERS.length - 1
  );

  DEDUCTION_HEADERS.forEach((label, index) => {
    const col = LEADING_HEADERS.length + index;
    setCell(ws, HEADER_ROW_2, col, label, headerCellStyle());
  });

  TRAILING_HEADERS.forEach((label, index) => {
    const col = LEADING_HEADERS.length + DEDUCTION_HEADERS.length + index;
    setCell(ws, HEADER_ROW, col, label, headerCellStyle());
    mergeCol(ws, col, HEADER_ROW, HEADER_ROW_2);
  });

  dataRows.forEach((cells, rowIndex) => {
    const r = DATA_START_ROW + rowIndex;
    const alt = rowIndex % 2 === 1;
    cells.forEach((value, col) => {
      setCell(
        ws,
        r,
        col,
        value,
        bodyCellStyle(col, {
          alt,
          netPay: col === NET_PAY_COL,
        })
      );
    });
  });

  summaryCells(ledger).forEach((value, col) => {
    setCell(
      ws,
      SUMMARY_ROW,
      col,
      value,
      bodyCellStyle(col, {
        summary: true,
        netPay: col === NET_PAY_COL,
      })
    );
  });

  ws["!rows"] = [
    { hpt: 34 },
    { hpt: 22 },
    { hpt: 24 },
    { hpt: 8 },
    { hpt: 24 },
    { hpt: 24 },
  ];

  ws["!cols"] = [
    { wch: 5 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
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
      xSplit: 2,
      ySplit: DATA_START_ROW,
      topLeftCell: XLSX.utils.encode_cell({ r: DATA_START_ROW, c: 2 }),
      activeCell: XLSX.utils.encode_cell({ r: DATA_START_ROW, c: 2 }),
    },
  ];

  return ws;
}

export function downloadPayrollLedgerExcel(ledger: PayrollLedgerResult): void {
  const ws = buildStyledSheet(ledger);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "급여대장");
  XLSX.writeFile(
    wb,
    `급여대장_${ledger.companyLabel}_${ledger.yearMonth}.xlsx`
  );
}
