/** 업로드 1건당 최대 크기 (8MB) */
export const HR_DOCUMENT_MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "hwp",
  "hwpx",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "zip",
  "txt",
  "csv",
]);

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1].toLowerCase();
}

export function isAllowedHrFilename(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ALLOWED_EXTENSIONS.has(ext);
}

export function validateHrUploadFile(file: File): string | null {
  if (!file.name.trim()) return "파일 이름이 없습니다.";
  if (!isAllowedHrFilename(file.name)) {
    return "지원하지 않는 형식입니다. PDF, DOC, XLS, HWP, 이미지, ZIP 등을 사용해 주세요.";
  }
  if (file.size <= 0) return "빈 파일은 업로드할 수 없습니다.";
  if (file.size > HR_DOCUMENT_MAX_BYTES) {
    return `파일 크기는 ${formatFileSize(HR_DOCUMENT_MAX_BYTES)} 이하여야 합니다.`;
  }
  return null;
}

export function formatUploadTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
