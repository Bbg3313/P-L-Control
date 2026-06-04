import "server-only";

type PdfParseFn = (data: Buffer) => Promise<{ text?: string }>;

async function loadPdfParse(): Promise<PdfParseFn> {
  const mod = await import("pdf-parse");
  if (typeof mod === "function") {
    return mod as PdfParseFn;
  }
  const withDefault = mod as { default?: PdfParseFn };
  if (typeof withDefault.default === "function") {
    return withDefault.default;
  }
  throw new Error("pdf-parse module not loaded");
}

export async function extractPdfTextFromBuffer(buffer: Buffer): Promise<string> {
  const parsePdf = await loadPdfParse();
  const result = await parsePdf(buffer);
  return (result.text ?? "").trim();
}
