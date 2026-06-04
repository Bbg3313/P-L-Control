export const HR_DOCUMENT_CATEGORIES = [
  "근로계약서",
  "중요서류",
  "기타",
] as const;

export type HrDocumentCategory = (typeof HR_DOCUMENT_CATEGORIES)[number];

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
  return isHrDocumentCategory(trimmed) ? trimmed : "기타";
}
