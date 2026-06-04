export const HR_DOCUMENT_CATEGORIES = [
  "근로계약서",
  "비밀유지서약서",
  "기타",
] as const;

export type HrDocumentCategory = (typeof HR_DOCUMENT_CATEGORIES)[number];

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
