import { getFileExtension } from "@/lib/hr-file-utils";
import { extractPdfTextFromBuffer } from "@/lib/hr-pdf-text.server";
import type {
  HrDocumentCategory,
  HrSalaryExtractStatus,
} from "@/lib/hr-documents-types";

export interface HrSalaryExtractionResult {
  annualSalary: number | null;
  status: HrSalaryExtractStatus;
  /** 디버그·UI용: 추출된 글자 수 */
  textLength?: number;
}

const MIN_ANNUAL_SALARY = 10_000_000;
const MAX_ANNUAL_SALARY = 1_500_000_000;
const MIN_MONTHLY_SALARY = 1_500_000;
const MAX_MONTHLY_SALARY = 12_000_000;

interface SalaryCandidate {
  amount: number;
  score: number;
}

function parseDigits(raw: string): number {
  const n = Number.parseInt(raw.replace(/[\s,]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function toAnnualAmount(value: number, unit: "won" | "man"): number {
  return unit === "man" ? value * 10_000 : value;
}

function isPlausibleAnnual(amount: number): boolean {
  return amount >= MIN_ANNUAL_SALARY && amount <= MAX_ANNUAL_SALARY;
}

function collapseDigits(raw: string): string {
  return raw.replace(/[\s,]/g, "");
}

function scoreContext(context: string): number {
  let score = 0;
  const n = context.replace(/\s+/g, "");

  if (/연봉.*총|총.*연봉|연봉총액|연봉금액|기본연봉/.test(n)) score += 35;
  if (n.includes("연봉")) score += 22;
  if (/급여총액|보수총액|임금총액|연간급여/.test(n)) score += 14;
  if (/월급|월급여|월임금|매월|월별|월지급|월급여/.test(n)) score -= 22;
  if (/일급|시급|시간당/.test(n)) score -= 35;
  if (/상여|인센티브|성과급/.test(n) && !n.includes("연봉")) score -= 10;

  return score;
}

function pushCandidate(
  candidates: SalaryCandidate[],
  amount: number,
  context: string,
  bonus: number
) {
  if (isPlausibleAnnual(amount)) {
    candidates.push({ amount, score: scoreContext(context) + bonus });
  }
}

function amountFromMatch(
  digitsRaw: string,
  hasMan: boolean,
  context: string
): number | null {
  const digits = parseDigits(digitsRaw);
  if (digits <= 0) return null;

  if (hasMan) {
    return toAnnualAmount(digits, "man");
  }
  if (digits >= 1_000_000) {
    return digits;
  }
  if (digits >= 100 && scoreContext(context) >= 15) {
    return toAnnualAmount(digits, "man");
  }
  return null;
}

function collectFromChunk(chunk: string): SalaryCandidate[] {
  const candidates: SalaryCandidate[] = [];

  const patterns: {
    regex: RegExp;
    hasManGroup?: boolean;
  }[] = [
    {
      regex:
        /연\s*봉\s*(?:총\s*)?(?:금액|액|금)?\s*[:：]?\s*([0-9][0-9,\s]{2,})\s*(만\s*)?원?/gi,
      hasManGroup: true,
    },
    {
      regex: /(?:총\s*)?연\s*봉\s*[:：]?\s*([0-9][0-9,\s]{2,})\s*(만\s*)?원?/gi,
      hasManGroup: true,
    },
    {
      regex:
        /기\s*본\s*연\s*봉\s*[:：]?\s*([0-9][0-9,\s]{2,})\s*(만\s*)?원?/gi,
      hasManGroup: true,
    },
    {
      regex:
        /급\s*여\s*(?:총\s*)?(?:금액|액)?\s*[:：]?\s*([0-9][0-9,\s]{2,})\s*(만\s*)?원?/gi,
      hasManGroup: true,
    },
    {
      regex:
        /보\s*수\s*총\s*액\s*[:：]?\s*([0-9][0-9,\s]{2,})\s*(만\s*)?원?/gi,
      hasManGroup: true,
    },
    {
      regex:
        /연\s*간\s*급\s*여\s*[:：]?\s*([0-9][0-9,\s]{2,})\s*(만\s*)?원?/gi,
      hasManGroup: true,
    },
    {
      regex:
        /연\s*봉[^0-9]{0,80}?([0-9][0-9,\s]{5,})\s*(만\s*)?원?/gi,
      hasManGroup: true,
    },
  ];

  for (const { regex, hasManGroup } of patterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(chunk)) !== null) {
      const start = Math.max(0, match.index - 40);
      const end = Math.min(chunk.length, match.index + match[0].length + 40);
      const context = chunk.slice(start, end);
      const hasMan = hasManGroup ? Boolean(match[2]) : false;
      const amount = amountFromMatch(match[1], hasMan, context);
      if (amount) pushCandidate(candidates, amount, context, hasMan ? 12 : 8);
    }
  }

  const eokMan = /([0-9,]+)\s*억\s*([0-9,]+)?\s*만?\s*원?/gi;
  let eokMatch: RegExpExecArray | null;
  while ((eokMatch = eokMan.exec(chunk)) !== null) {
    const start = Math.max(0, eokMatch.index - 60);
    const end = Math.min(chunk.length, eokMatch.index + eokMatch[0].length + 20);
    const context = chunk.slice(start, end);
    const eok = parseDigits(eokMatch[1]);
    const man = eokMatch[2] ? parseDigits(eokMatch[2]) : 0;
    pushCandidate(
      candidates,
      eok * 100_000_000 + man * 10_000,
      context,
      24
    );
  }

  const cheonMan = /([0-9,]+)\s*천\s*만\s*원?/gi;
  let cheonMatch: RegExpExecArray | null;
  while ((cheonMatch = cheonMan.exec(chunk)) !== null) {
    const context = chunk.slice(
      Math.max(0, cheonMatch.index - 60),
      cheonMatch.index + cheonMatch[0].length + 20
    );
    pushCandidate(
      candidates,
      parseDigits(cheonMatch[1]) * 10_000_000,
      context,
      16
    );
  }

  if (scoreContext(chunk) >= 12) {
    const manWon = /([0-9,]+)\s*만\s*원?/gi;
    let manMatch: RegExpExecArray | null;
    while ((manMatch = manWon.exec(chunk)) !== null) {
      const context = chunk.slice(
        Math.max(0, manMatch.index - 60),
        manMatch.index + manMatch[0].length + 20
      );
      pushCandidate(
        candidates,
        toAnnualAmount(parseDigits(manMatch[1]), "man"),
        context,
        10
      );
    }
  }

  return candidates;
}

function inferAnnualFromMonthly(text: string): SalaryCandidate | null {
  const monthlyPatterns = [
    /월\s*(?:급|급여|임금|기본급)\s*[:：]?\s*([0-9][0-9,\s]{2,})\s*(만\s*)?원?/gi,
    /(?:기본급|급여)\s*[:：]?\s*([0-9][0-9,\s]{2,})\s*(만\s*)?원?/gi,
  ];

  let best: SalaryCandidate | null = null;

  for (const regex of monthlyPatterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const context = text.slice(
        Math.max(0, match.index - 30),
        match.index + match[0].length + 30
      );
      const digits = parseDigits(match[1]);
      const monthly = match[2]
        ? toAnnualAmount(digits, "man")
        : digits >= 100_000
          ? digits
          : toAnnualAmount(digits, "man");
      if (
        !monthly ||
        monthly < MIN_MONTHLY_SALARY ||
        monthly > MAX_MONTHLY_SALARY
      ) {
        continue;
      }
      const annual = monthly * 12;
      if (!isPlausibleAnnual(annual)) continue;

      const candidate: SalaryCandidate = {
        amount: annual,
        score: scoreContext(context) + 5,
      };
      if (!best || candidate.amount > best.amount) {
        best = candidate;
      }
    }
  }

  return best;
}

/** PDF 추출 텍스트 정규화 */
function normalizeContractText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[₩￦]/g, "")
    .replace(/\d[\d,\s]*\d|\d[\d,]+/g, (segment) => collapseDigits(segment));
}

export function parseAnnualSalaryFromContractText(
  text: string
): HrSalaryExtractionResult {
  const normalized = normalizeContractText(text).trim();
  if (!normalized) {
    return { annualSalary: null, status: "not_found", textLength: 0 };
  }

  const chunks = [
    normalized.replace(/\r?\n+/g, " "),
    normalized,
    ...normalized.split(/\r?\n/).filter((line) => line.trim().length > 0),
  ];

  const allCandidates: SalaryCandidate[] = [];
  for (const chunk of chunks) {
    allCandidates.push(...collectFromChunk(chunk));
  }

  if (allCandidates.length > 0) {
    allCandidates.sort((a, b) => b.score - a.score || b.amount - a.amount);
    return {
      annualSalary: allCandidates[0].amount,
      status: "found",
      textLength: normalized.length,
    };
  }

  const monthly = inferAnnualFromMonthly(
    normalized.replace(/\r?\n+/g, " ")
  );
  if (monthly && isPlausibleAnnual(monthly.amount)) {
    return {
      annualSalary: monthly.amount,
      status: "found",
      textLength: normalized.length,
    };
  }

  return {
    annualSalary: null,
    status: "not_found",
    textLength: normalized.length,
  };
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

export type HrTextExtractionFormat = "pdf" | "docx" | "txt" | "unsupported";

export function getHrTextExtractionFormat(
  filename: string,
  mimeType: string
): HrTextExtractionFormat {
  const ext = getFileExtension(filename);
  const mime = mimeType.toLowerCase();

  if (mime.includes("pdf") || ext === "pdf") return "pdf";
  if (mime.includes("wordprocessingml") || ext === "docx") return "docx";
  if (ext === "txt" || mime.startsWith("text/")) return "txt";

  return "unsupported";
}

export async function extractTextFromHrDocument(input: {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}): Promise<{ text: string; extractFailed: boolean } | { unsupported: true }> {
  const format = getHrTextExtractionFormat(input.filename, input.mimeType);
  if (format === "unsupported") return { unsupported: true };

  try {
    if (format === "pdf") {
      return {
        text: await extractPdfTextFromBuffer(input.buffer),
        extractFailed: false,
      };
    }
    if (format === "docx") {
      return { text: await extractDocxText(input.buffer), extractFailed: false };
    }
    return { text: input.buffer.toString("utf-8"), extractFailed: false };
  } catch (err) {
    console.error("[hr-contract-salary] text extraction failed:", err);
    return { text: "", extractFailed: true };
  }
}

export async function extractAnnualSalaryFromContract(input: {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  category: HrDocumentCategory;
}): Promise<HrSalaryExtractionResult> {
  if (input.category !== "근로계약서") {
    return { annualSalary: null, status: "skipped" };
  }

  const extracted = await extractTextFromHrDocument(input);
  if ("unsupported" in extracted) {
    return { annualSalary: null, status: "unsupported" };
  }
  if (extracted.extractFailed) {
    return { annualSalary: null, status: "extract_failed", textLength: 0 };
  }
  if (!extracted.text.trim()) {
    return { annualSalary: null, status: "not_found", textLength: 0 };
  }

  return parseAnnualSalaryFromContractText(extracted.text);
}
