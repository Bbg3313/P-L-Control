export const HR_DOCUMENT_CATEGORIES = [
  "근로계약서",
  "비밀유지서약서",
  "기타",
] as const;

export type HrDocumentCategory = (typeof HR_DOCUMENT_CATEGORIES)[number];

export type HrSalaryExtractStatus =
  | "found"
  | "not_found"
  | "unsupported"
  | "extract_failed"
  | "skipped";

/** 예전 분류(중요서류) → 비밀유지서약서 */
const LEGACY_CATEGORY_MAP: Record<string, HrDocumentCategory> = {
  중요서류: "비밀유지서약서",
};

export interface HrDocumentMeta {
  id: string;
  name: string;
  category: HrDocumentCategory;
  mimeType: string;
  size: number;
  uploadedAt: string;
  /** 근로계약서에서 추출한 연봉(원) */
  annualSalary?: number | null;
  salaryExtractStatus?: HrSalaryExtractStatus;
  /** 연봉 추출 시 PDF/문서에서 읽은 글자 수 */
  salaryTextLength?: number;
}

export function normalizeHrDocumentMeta(
  raw: Partial<HrDocumentMeta> & Record<string, unknown>
): HrDocumentMeta {
  const annualSalary =
    typeof raw.annualSalary === "number" && raw.annualSalary > 0
      ? Math.floor(raw.annualSalary)
      : null;

  const status = raw.salaryExtractStatus;
  const salaryExtractStatus =
    status === "found" ||
    status === "not_found" ||
    status === "unsupported" ||
    status === "extract_failed" ||
    status === "skipped"
      ? status
      : annualSalary
        ? "found"
        : undefined;

  return {
    id: String(raw.id),
    name: String(raw.name),
    category: normalizeHrDocumentCategory(raw.category),
    mimeType: String(raw.mimeType ?? "application/octet-stream"),
    size: Number(raw.size) || 0,
    uploadedAt: String(raw.uploadedAt ?? new Date().toISOString()),
    annualSalary,
    salaryExtractStatus,
    salaryTextLength:
      typeof raw.salaryTextLength === "number" && raw.salaryTextLength >= 0
        ? Math.floor(raw.salaryTextLength)
        : undefined,
  };
}

export interface HrDocumentsManifest {
  documents: HrDocumentMeta[];
  updatedAt: string;
}

export function isHrDocumentCategory(value: string): value is HrDocumentCategory {
  return (HR_DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}

export function normalizeHrDocumentCategory(value: unknown): HrDocumentCategory {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (isHrDocumentCategory(trimmed)) return trimmed;
  if (trimmed && LEGACY_CATEGORY_MAP[trimmed]) {
    return LEGACY_CATEGORY_MAP[trimmed];
  }
  return "기타";
}
