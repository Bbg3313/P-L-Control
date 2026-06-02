import * as XLSX from "xlsx";
import { parseAmountInput } from "@/lib/calculations";
import { normalizeRevenueDetailCategory } from "@/lib/revenue-detail-categories";

export interface RevenueImportRow {
  date: string;
  client: string;
  detailCategory: string;
  category: string;
  amount: number;
}

export interface RevenueImportError {
  row: number;
  message: string;
}

export interface RevenueImportResult {
  rows: RevenueImportRow[];
  errors: RevenueImportError[];
}

const HEADER_ALIASES: Record<keyof RevenueImportRow, string[]> = {
  date: ["날짜", "date", "일자", "거래일"],
  client: ["매출처", "거래처", "client", "고객사", "매출처명"],
  detailCategory: [
    "상세카테고리",
    "상세 카테고리",
    "detailcategory",
    "세부카테고리",
  ],
  category: ["카테고리", "category", "분류", "항목"],
  amount: ["금액", "amount", "매출액", "매출", "공급가액"],
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function detectColumns(headerRow: unknown[]): Partial<Record<keyof RevenueImportRow, number>> {
  const indices: Partial<Record<keyof RevenueImportRow, number>> = {};

  headerRow.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);
    if (!normalized) return;

    (Object.keys(HEADER_ALIASES) as (keyof RevenueImportRow)[]).forEach((key) => {
      if (indices[key] !== undefined) return;
      const matched = HEADER_ALIASES[key].some(
        (alias) => normalizeHeader(alias) === normalized
      );
      if (matched) indices[key] = index;
    });
  });

  return indices;
}

function excelSerialToIsoDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed) return null;
  const y = parsed.y;
  const m = String(parsed.m).padStart(2, "0");
  const d = String(parsed.d).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateCell(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return excelSerialToIsoDate(value);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = raw.replace(/\./g, "-").replace(/\//g, "-");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const [, y, m, d] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return null;
}

function parseAmountCell(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }
  return parseAmountInput(String(value ?? ""));
}

function sheetToMatrix(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
}

export function parseRevenueSpreadsheet(buffer: ArrayBuffer): RevenueImportResult {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: [{ row: 0, message: "시트가 비어 있습니다." }] };
  }

  const matrix = sheetToMatrix(workbook.Sheets[sheetName]);
  if (matrix.length === 0) {
    return { rows: [], errors: [{ row: 0, message: "데이터가 없습니다." }] };
  }

  const headerIndex = matrix.findIndex((row) =>
    row.some((cell) => String(cell ?? "").trim() !== "")
  );
  if (headerIndex < 0) {
    return { rows: [], errors: [{ row: 0, message: "헤더 행을 찾을 수 없습니다." }] };
  }

  const columns = detectColumns(matrix[headerIndex]);
  const missing = (["date", "client", "category", "amount"] as const).filter(
    (key) => columns[key] === undefined
  );

  if (missing.length > 0) {
    const labels: Record<keyof RevenueImportRow, string> = {
      date: "날짜",
      client: "매출처",
      detailCategory: "상세 카테고리",
      category: "카테고리",
      amount: "금액",
    };
    return {
      rows: [],
      errors: [
        {
          row: headerIndex + 1,
          message: `필수 열이 없습니다: ${missing.map((k) => labels[k]).join(", ")}. 첫 행에 날짜·매출처·카테고리·금액 헤더를 넣어 주세요.`,
        },
      ],
    };
  }

  const rows: RevenueImportRow[] = [];
  const errors: RevenueImportError[] = [];

  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const row = matrix[i];
    const excelRow = i + 1;
    const isEmpty = !row || row.every((cell) => String(cell ?? "").trim() === "");
    if (isEmpty) continue;

    const date = parseDateCell(row[columns.date!]);
    const client = String(row[columns.client!] ?? "").trim();
    const category = String(row[columns.category!] ?? "").trim();
    const detailRaw =
      columns.detailCategory !== undefined
        ? String(row[columns.detailCategory] ?? "").trim()
        : "";
    const detailCategory = normalizeRevenueDetailCategory(detailRaw);
    const amount = parseAmountCell(row[columns.amount!]);

    if (!date) {
      errors.push({ row: excelRow, message: "날짜 형식이 올바르지 않습니다." });
      continue;
    }
    if (!client) {
      errors.push({ row: excelRow, message: "매출처가 비어 있습니다." });
      continue;
    }
    if (!category) {
      errors.push({ row: excelRow, message: "카테고리가 비어 있습니다." });
      continue;
    }
    if (amount <= 0) {
      errors.push({ row: excelRow, message: "금액은 0보다 커야 합니다." });
      continue;
    }

    rows.push({ date, client, detailCategory, category, amount });
  }

  return { rows, errors };
}

export const REVENUE_TEMPLATE_HEADERS = [
  "날짜",
  "매출처",
  "상세 카테고리",
  "카테고리",
  "금액",
] as const;

export function buildRevenueTemplateCsv(): string {
  const bom = "\uFEFF";
  const sample = [
    ["2026-06-15", "예시 거래처", "화장품", "대행 수수료", "5000000"],
  ];
  const lines = [
    REVENUE_TEMPLATE_HEADERS.join(","),
    ...sample.map((row) => row.join(",")),
  ];
  return bom + lines.join("\n");
}

export function downloadRevenueTemplate(): void {
  const blob = new Blob([buildRevenueTemplateCsv()], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "매출_업로드_양식.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
