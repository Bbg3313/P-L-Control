import "server-only";

type PdfParseFn = (data: Buffer) => Promise<{ text?: string }>;

const MIN_USABLE_TEXT = 24;

function isPdfBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  );
}

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

async function extractWithPdfParse(buffer: Buffer): Promise<string> {
  const parsePdf = await loadPdfParse();
  const result = await parsePdf(buffer);
  return (result.text ?? "").trim();
}

async function extractWithPdfJs(buffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const doc = await loadingTask.promise;
  const parts: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
      .join(" ");
    if (line.trim()) parts.push(line);
  }

  return parts.join("\n").trim();
}

export async function extractPdfTextFromBuffer(buffer: Buffer): Promise<string> {
  if (!isPdfBuffer(buffer)) {
    return "";
  }

  let text = "";
  try {
    text = await extractWithPdfParse(buffer);
  } catch (err) {
    console.error("[hr-pdf-text] pdf-parse failed:", err);
  }

  if (text.length >= MIN_USABLE_TEXT) {
    return text;
  }

  try {
    const fallback = await extractWithPdfJs(buffer);
    if (fallback.length > text.length) {
      return fallback;
    }
  } catch (err) {
    console.error("[hr-pdf-text] pdfjs fallback failed:", err);
  }

  return text;
}

export { isPdfBuffer };
