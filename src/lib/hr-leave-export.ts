import * as XLSX from "xlsx-js-style";
import type { HrLeaveEntry } from "@/lib/hr-leave-types";
import { formatHrRecordDate } from "@/lib/hr-records-utils";

export interface HrLeaveExportRow {
  name: string;
  department: string;
  position: string;
  status: string;
  acquiredDate: string;
  grantedDays: number;
  usedDays: number;
  remainingDays: number;
  entries: HrLeaveEntry[];
  ruleLabel: string;
  useByDate: string | null;
}

const COLORS = {
  titleBg: "EEF2FF",
  titleText: "1E293B",
  subtitleText: "64748B",
  headerBg: "334155",
  headerText: "FFFFFF",
  border: "CBD5E1",
  rowAlt: "F8FAFC",
  summaryBg: "F1F5F9",
};

type CellStyle = XLSX.CellStyle;

const THIN_BORDER = {
  top: { style: "thin" as const, color: { rgb: COLORS.border } },
  bottom: { style: "thin" as const, color: { rgb: COLORS.border } },
  left: { style: "thin" as const, color: { rgb: COLORS.border } },
  right: { style: "thin" as const, color: { rgb: COLORS.border } },
};

function baseFont(
  size = 11,
  bold = false,
  color = COLORS.titleText
): CellStyle["font"] {
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
    ...(isNumber ? { z: "0.0" } : {}),
    ...(style ? { s: style } : {}),
  };
}

function headerStyle(): CellStyle {
  return {
    font: baseFont(10, true, COLORS.headerText),
    fill: { fgColor: { rgb: COLORS.headerBg } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: THIN_BORDER,
  };
}

function bodyStyle(
  options?: { alt?: boolean; center?: boolean; right?: boolean; bold?: boolean }
): CellStyle {
  return {
    font: baseFont(11, options?.bold),
    fill: {
      fgColor: { rgb: options?.alt ? COLORS.rowAlt : "FFFFFF" },
    },
    alignment: {
      horizontal: options?.center ? "center" : options?.right ? "right" : "left",
      vertical: "center",
    },
    border: THIN_BORDER,
  };
}

function formatDays(value: number): number {
  return Math.round(value * 10) / 10;
}

function todayStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function buildStatusSheet(employees: HrLeaveExportRow[]): XLSX.WorkSheet {
  const headers = [
    "번호",
    "성명",
    "부서",
    "직책",
    "상태",
    "입사일",
    "발생일수",
    "사용일수",
    "잔여일수",
    "산정기준",
    "사용기한",
  ];
  const colCount = headers.length;
  const ws: XLSX.WorkSheet = {};
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
  ];

  setCell(ws, 0, 0, "연차 현황", {
    font: baseFont(16, true),
    fill: { fgColor: { rgb: COLORS.titleBg } },
    alignment: { horizontal: "left", vertical: "center" },
  });
  setCell(
    ws,
    1,
    0,
    `다운로드일 ${formatHrRecordDate(new Date().toISOString().slice(0, 10))} · 재직·휴직 기준`,
    {
      font: baseFont(9, false, COLORS.subtitleText),
      alignment: { horizontal: "left", vertical: "center" },
    }
  );

  headers.forEach((h, c) => setCell(ws, 3, c, h, headerStyle()));

  employees.forEach((emp, index) => {
    const r = 4 + index;
    const alt = index % 2 === 1;
    const values: (string | number)[] = [
      index + 1,
      emp.name,
      emp.department || "—",
      emp.position || "—",
      emp.status,
      emp.acquiredDate ? formatHrRecordDate(emp.acquiredDate) : "—",
      formatDays(emp.grantedDays),
      formatDays(emp.usedDays),
      formatDays(emp.remainingDays),
      emp.ruleLabel || "—",
      emp.useByDate ? formatHrRecordDate(emp.useByDate) : "—",
    ];
    values.forEach((val, c) => {
      const isDayCol = c >= 6 && c <= 8;
      setCell(
        ws,
        r,
        c,
        val,
        bodyStyle({
          alt,
          center: c === 0 || c === 4 || c === 5 || c === 10,
          right: isDayCol,
          bold: c === 8,
        })
      );
    });
  });

  const summaryRow = 4 + employees.length;
  const totalGranted = employees.reduce((s, e) => s + e.grantedDays, 0);
  const totalUsed = employees.reduce((s, e) => s + e.usedDays, 0);
  const totalRemaining = employees.reduce((s, e) => s + e.remainingDays, 0);
  const summary: (string | number)[] = [
    "",
    "합계",
    "",
    "",
    "",
    "",
    formatDays(totalGranted),
    formatDays(totalUsed),
    formatDays(totalRemaining),
    "",
    "",
  ];
  summary.forEach((val, c) => {
    setCell(ws, summaryRow, c, val, {
      font: baseFont(11, true),
      fill: { fgColor: { rgb: COLORS.summaryBg } },
      alignment: {
        horizontal: c >= 6 && c <= 8 ? "right" : c === 1 ? "center" : "left",
        vertical: "center",
      },
      border: THIN_BORDER,
    });
  });

  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: summaryRow, c: colCount - 1 },
  });
  ws["!cols"] = [
    { wch: 6 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 8 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 28 },
    { wch: 12 },
  ];
  ws["!rows"] = [{ hpt: 28 }, { hpt: 18 }, { hpt: 8 }, { hpt: 22 }];

  return ws;
}

function buildUsageSheet(employees: HrLeaveExportRow[]): XLSX.WorkSheet {
  const headers = ["번호", "성명", "부서", "사용일", "구분", "일수"];
  const colCount = headers.length;
  const ws: XLSX.WorkSheet = {};
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
  ];

  setCell(ws, 0, 0, "연차 사용 내역", {
    font: baseFont(16, true),
    fill: { fgColor: { rgb: COLORS.titleBg } },
    alignment: { horizontal: "left", vertical: "center" },
  });
  setCell(
    ws,
    1,
    0,
    `다운로드일 ${formatHrRecordDate(new Date().toISOString().slice(0, 10))}`,
    {
      font: baseFont(9, false, COLORS.subtitleText),
      alignment: { horizontal: "left", vertical: "center" },
    }
  );

  headers.forEach((h, c) => setCell(ws, 3, c, h, headerStyle()));

  const usageRows = employees
    .flatMap((emp) =>
      [...emp.entries]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((entry) => ({
          name: emp.name,
          department: emp.department || "—",
          date: entry.date,
          type: entry.type,
          days: entry.days,
        }))
    )
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return a.name.localeCompare(b.name, "ko");
    });

  usageRows.forEach((row, index) => {
    const r = 4 + index;
    const alt = index % 2 === 1;
    const values: (string | number)[] = [
      index + 1,
      row.name,
      row.department,
      formatHrRecordDate(row.date),
      row.type,
      formatDays(row.days),
    ];
    values.forEach((val, c) => {
      setCell(
        ws,
        r,
        c,
        val,
        bodyStyle({
          alt,
          center: c === 0 || c === 3 || c === 4,
          right: c === 5,
        })
      );
    });
  });

  const lastRow = usageRows.length === 0 ? 4 : 3 + usageRows.length;
  if (usageRows.length === 0) {
    setCell(ws, 4, 0, "등록된 사용 내역이 없습니다.", bodyStyle());
    for (let c = 1; c < colCount; c++) setCell(ws, 4, c, "", bodyStyle());
  } else {
    const summaryRow = lastRow + 1;
    const totalDays = usageRows.reduce((s, row) => s + row.days, 0);
    const summary: (string | number)[] = [
      "",
      "합계",
      "",
      "",
      `${usageRows.length}건`,
      formatDays(totalDays),
    ];
    summary.forEach((val, c) => {
      setCell(ws, summaryRow, c, val, {
        font: baseFont(11, true),
        fill: { fgColor: { rgb: COLORS.summaryBg } },
        alignment: {
          horizontal: c === 5 ? "right" : "center",
          vertical: "center",
        },
        border: THIN_BORDER,
      });
    });
  }

  const endRow = usageRows.length === 0 ? 4 : lastRow + 1;
  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: endRow, c: colCount - 1 },
  });
  ws["!cols"] = [
    { wch: 6 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 8 },
    { wch: 8 },
  ];
  ws["!rows"] = [{ hpt: 28 }, { hpt: 18 }, { hpt: 8 }, { hpt: 22 }];

  return ws;
}

export function downloadHrLeaveExcel(employees: HrLeaveExportRow[]): void {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildStatusSheet(employees), "연차현황");
  XLSX.utils.book_append_sheet(wb, buildUsageSheet(employees), "사용내역");
  XLSX.writeFile(wb, `연차현황_${todayStamp()}.xlsx`);
}
